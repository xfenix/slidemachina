import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const elkWorkerSource = "elkjs/lib/elk-worker";
const emptyWorkerId = "\0slidemachina-empty-elk-worker";
const skippedFolderNames = new Set(["node_modules", "dist"]);
// <Diagram>, <Machina.Diagram>, <Sequence>: the tags that lay boxes out with ELK.
const diagramTagPattern = /<(?:\w+\.)?(?:Diagram|Sequence)[\s/>]/;

function listSlideFiles(searchedFolder: string): string[] {
  return readdirSync(searchedFolder, { withFileTypes: true }).flatMap((folderEntry) => {
    const entryPath = path.join(searchedFolder, folderEntry.name);
    if (folderEntry.isDirectory()) return skippedFolderNames.has(folderEntry.name) || folderEntry.name.startsWith(".") ? [] : listSlideFiles(entryPath);
    return /\.[jt]sx$/.test(folderEntry.name) ? [entryPath] : [];
  });
}

// The ELK worker is 1.6 MB, 460 KB gzip: a talk without diagrams gets an empty module instead and never ships it.
export function createElkWorkerStubPlugin(rootFolder: string): Plugin {
  const drawsDiagrams = listSlideFiles(rootFolder).some((slideFile) => diagramTagPattern.test(readFileSync(slideFile, "utf8")));
  return {
    name: "slidemachina-elk-worker-stub",
    enforce: "pre",
    resolveId(importedId) {
      return !drawsDiagrams && importedId.startsWith(elkWorkerSource) ? emptyWorkerId : undefined;
    },
    load(moduleId) {
      return moduleId === emptyWorkerId ? "export default '';" : undefined;
    },
  };
}
