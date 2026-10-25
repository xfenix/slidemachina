import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";

// The package root: browser-runtime/, server-runtime/ and shared-between-runtimes/ lie inside it.
export const enginePackageFolder = fileURLToPath(new URL("../..", import.meta.url));

// A folder run with npx has no node_modules: these packages come from the engine's install, with one copy of React.
const sharedPackageNames = ["react", "react-dom", "three", "agentation", "tailwindcss"];
const packageRequire = createRequire(path.join(enginePackageFolder, "package.json"));

const sharedPackageFolders = sharedPackageNames.flatMap((packageName: string) => {
  const packageLocation = findPackageFolder(packageName);
  return packageLocation === undefined ? [] : [{ packageName, packageLocation }];
});

export const engineResolution = {
  alias: [
    { find: /^slidemachina$/, replacement: path.join(enginePackageFolder, "browser-runtime", "slidemachina.ts") },
    ...sharedPackageFolders.map(({ packageName, packageLocation }) => ({ find: new RegExp(`^${packageName}(?=/|$)`), replacement: packageLocation })),
  ],
};

function findPackageFolder(packageName: string): string | undefined {
  const searchedFolders = packageRequire.resolve.paths(packageName) ?? [];
  const modulesFolder = searchedFolders.find((candidateFolder: string) => existsSync(path.join(candidateFolder, packageName, "package.json")));
  return modulesFolder === undefined ? undefined : path.join(modulesFolder, packageName);
}

// The engine's dependencies may lie next to it rather than inside it, as in the npx cache.
export function listAllowedFolders(siteLayout: SiteLayout): string[] {
  const repositoryFolder = siteLayout.themeStylesheet === undefined ? [] : [path.dirname(path.dirname(siteLayout.themeStylesheet))];
  const dependencyFolders = sharedPackageFolders.map(({ packageLocation }) => path.dirname(packageLocation));
  return [...new Set([siteLayout.rootFolder, enginePackageFolder, ...repositoryFolder, ...dependencyFolders])];
}
