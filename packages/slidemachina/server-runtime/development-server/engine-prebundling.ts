import path from "node:path";
import { enginePackageFolder, presentationMountingId } from "./engine-resolution.ts";
import type { DepOptimizationOptions, Rolldown } from "vite";

const urlQuerySuffix = "?url";
const engineEntryIds = ["slidemachina", presentationMountingId];
const isEngineInstalled = enginePackageFolder.split(path.sep).includes("node_modules");

// The pre-bundler cannot load "file.js?url"; Vite serves such an import as an address once it stays outside the bundle.
const addressImportExternalizing: Rolldown.Plugin = {
  name: "slidemachina-address-imports",
  resolveId: {
    filter: { id: /\?url$/ },
    async handler(importedId, importerPath) {
      const resolvedImport = await this.resolve(importedId.slice(0, -urlQuerySuffix.length), importerPath);
      return resolvedImport === null ? null : { id: `${resolvedImport.id}${urlQuerySuffix}`, external: "absolute" };
    },
  },
};

// Installed from npm, the engine is bundled once into node_modules/.vite like any dependency: the page loads a few files
// instead of a hundred modules, and a restart skips compiling them. A linked engine, as in this repository, stays source,
// so an edit of the engine shows up without a restart.
export function describeEnginePrebundling(): Pick<DepOptimizationOptions, "exclude" | "extensions" | "rolldownOptions"> & { include: string[] } {
  if (!isEngineInstalled) return { include: [], exclude: ["slidemachina"] };
  return { include: engineEntryIds, extensions: [".ts", ".tsx"], rolldownOptions: { plugins: [addressImportExternalizing] } };
}
