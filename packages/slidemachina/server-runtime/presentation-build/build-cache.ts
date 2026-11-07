import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { enginePackageFolder } from "../development-server/engine-resolution.ts";
import type { BuildReport } from "./image-compression.ts";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";

type OutputPaths = Record<string, string>;
type SerializedBuildReport = { savedPictureBytes: [string, number][]; videoSizes: [string, number][] };

const cacheFolder = path.join(os.homedir(), ".cache", "slidemachina", "bundles");
const hashLength = 16;
const largestCachedBuildCount = 20;
const skippedFolderNames = new Set(["node_modules", ".git", ".vite"]);

function isInsideFolder(candidatePath: string, folderPath: string): boolean {
  return candidatePath === folderPath || candidatePath.startsWith(`${folderPath}${path.sep}`);
}

function listSourceFiles(folderPath: string, excludedPaths: string[], visitedFolders: Set<string>): string[] {
  const realFolderPath = realpathSync(folderPath);
  if (visitedFolders.has(realFolderPath)) return [];
  visitedFolders.add(realFolderPath);
  const sourceFiles: string[] = [];
  for (const folderEntry of readdirSync(realFolderPath, { withFileTypes: true })) {
    const entryPath = path.join(realFolderPath, folderEntry.name);
    if (excludedPaths.some((excludedPath) => isInsideFolder(entryPath, excludedPath))) continue;
    const entryStats = statSync(entryPath, { throwIfNoEntry: false });
    if (entryStats === undefined) continue;
    if (entryStats.isDirectory()) {
      if (!skippedFolderNames.has(folderEntry.name)) sourceFiles.push(...listSourceFiles(entryPath, excludedPaths, visitedFolders));
    } else if (entryStats.isFile()) sourceFiles.push(entryPath);
  }
  return sourceFiles;
}

function hashSourceFolder(contentHash: ReturnType<typeof createHash>, folderPath: string, excludedPaths: string[]): void {
  const sourceFiles = listSourceFiles(folderPath, excludedPaths, new Set()).sort();
  for (const sourceFile of sourceFiles) {
    contentHash.update(path.relative(folderPath, sourceFile));
    contentHash.update(readFileSync(sourceFile));
  }
}

function hashDependencyVersions(contentHash: ReturnType<typeof createHash>): void {
  const packageManifestPath = path.join(enginePackageFolder, "package.json");
  const packageRequire = createRequire(packageManifestPath);
  const { dependencies = {} } = JSON.parse(readFileSync(packageManifestPath, "utf8")) as { dependencies?: Record<string, string> };
  for (const dependencyName of Object.keys(dependencies).sort()) {
    try {
      contentHash.update(readFileSync(packageRequire.resolve(`${dependencyName}/package.json`)));
    } catch {
      contentHash.update(dependencyName).update(dependencies[dependencyName] ?? "");
    }
  }
}

function hashNearestLockfile(contentHash: ReturnType<typeof createHash>, startFolder: string): void {
  let searchedFolder = startFolder;
  while (searchedFolder !== path.dirname(searchedFolder)) {
    const lockfilePath = path.join(searchedFolder, "package-lock.json");
    if (existsSync(lockfilePath)) {
      contentHash.update(readFileSync(lockfilePath));
      return;
    }
    searchedFolder = path.dirname(searchedFolder);
  }
}

function readBuildInputHash(siteLayout: SiteLayout, outputPaths: OutputPaths): string {
  const contentHash = createHash("sha256");
  const excludedPaths = Object.values(outputPaths).map((outputPath) => path.resolve(outputPath));
  contentHash.update(siteLayout.listAddress ?? "");
  if (siteLayout.themeStylesheet !== undefined) contentHash.update(readFileSync(siteLayout.themeStylesheet));
  hashSourceFolder(contentHash, siteLayout.rootFolder, excludedPaths);
  hashSourceFolder(contentHash, enginePackageFolder, []);
  hashDependencyVersions(contentHash);
  hashNearestLockfile(contentHash, siteLayout.rootFolder);
  hashNearestLockfile(contentHash, enginePackageFolder);
  return contentHash.digest("hex");
}

function readCachedReport(cacheEntryFolder: string, buildReport: BuildReport): void {
  const reportPath = path.join(cacheEntryFolder, "report.json");
  if (!existsSync(reportPath)) return;
  const cachedReport = JSON.parse(readFileSync(reportPath, "utf8")) as SerializedBuildReport;
  buildReport.savedPictureBytes = new Map(cachedReport.savedPictureBytes);
  buildReport.videoSizes = new Map(cachedReport.videoSizes);
}

function pruneOldBuilds(): void {
  const cacheEntries = readdirSync(cacheFolder, { withFileTypes: true })
    .filter((cacheEntry) => cacheEntry.isDirectory() && !cacheEntry.name.endsWith(".partial"))
    .map((cacheEntry) => {
      const cachePath = path.join(cacheFolder, cacheEntry.name);
      return { cachePath, modifiedAt: statSync(cachePath, { throwIfNoEntry: false })?.mtimeMs ?? 0 };
    })
    .sort((firstEntry, secondEntry) => secondEntry.modifiedAt - firstEntry.modifiedAt)
    .map(({ cachePath }) => cachePath);
  for (const oldCacheEntry of cacheEntries.slice(largestCachedBuildCount)) rmSync(oldCacheEntry, { recursive: true, force: true });
}

export function createBuildCache(siteLayout: SiteLayout, outputPaths: OutputPaths) {
  const inputHash = readBuildInputHash(siteLayout, outputPaths);
  const findCacheEntry = (isSingleFile: boolean) => path.join(cacheFolder, createHash("sha256").update(inputHash).update(String(isSingleFile)).digest("hex").slice(0, hashLength));
  return {
    restoreCachedBuild(buildFolder: string, isSingleFile: boolean, buildReport: BuildReport): boolean {
      const cacheEntryFolder = findCacheEntry(isSingleFile);
      const cachedOutput = path.join(cacheEntryFolder, "output");
      if (!existsSync(path.join(cachedOutput, "index.html"))) return false;
      try {
        cpSync(cachedOutput, buildFolder, { recursive: true, preserveTimestamps: true });
        readCachedReport(cacheEntryFolder, buildReport);
        return true;
      } catch {
        return false;
      }
    },
    saveBuiltOutput(buildFolder: string, isSingleFile: boolean, buildReport: BuildReport): void {
      const cacheEntryFolder = findCacheEntry(isSingleFile);
      if (existsSync(cacheEntryFolder)) return;
      const partialFolder = `${cacheEntryFolder}.${process.pid}.partial`;
      rmSync(partialFolder, { recursive: true, force: true });
      mkdirSync(path.dirname(cacheEntryFolder), { recursive: true });
      cpSync(buildFolder, path.join(partialFolder, "output"), { recursive: true, preserveTimestamps: true });
      const serializedReport: SerializedBuildReport = { savedPictureBytes: [...buildReport.savedPictureBytes], videoSizes: [...buildReport.videoSizes] };
      writeFileSync(path.join(partialFolder, "report.json"), JSON.stringify(serializedReport));
      try {
        renameSync(partialFolder, cacheEntryFolder);
      } catch (renameError) {
        rmSync(partialFolder, { recursive: true, force: true });
        if (!existsSync(cacheEntryFolder)) throw renameError;
      }
      pruneOldBuilds();
    },
  };
}
