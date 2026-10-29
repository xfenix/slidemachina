// Before npm publish. Node does not strip types under node_modules, so the command-line code of both packages ships as JavaScript;
// the page code stays TypeScript, Vite compiles it together with the presentation.
// The version comes from the release tag: v1.2.0 publishes 1.2.0, and new projects ask for slidemachina@^1.2.0.
import { execFileSync } from "node:child_process";
import { copyFileSync, globSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type PackageManifest = { version: string; bin: Record<string, string>; files?: string[]; dependencies?: Record<string, string> };

const workspaceFolder = path.resolve(import.meta.dirname, "..");
const repositoryName = "xfenix/slidemachina";
const releaseVersionPattern = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const compilerFlags = [
  "--ignoreConfig",
  "--noCheck",
  "--rewriteRelativeImportExtensions",
  "--allowImportingTsExtensions",
  "--module",
  "preserve",
  "--moduleResolution",
  "bundler",
  "--target",
  "es2023",
  "--skipLibCheck",
  "--declaration",
  "false",
];

function updateManifest(manifestPath: string, changeManifest: (packageManifest: PackageManifest) => void): void {
  const absoluteManifestPath = path.join(workspaceFolder, manifestPath);
  const packageManifest = JSON.parse(readFileSync(absoluteManifestPath, "utf8")) as PackageManifest;
  changeManifest(packageManifest);
  writeFileSync(absoluteManifestPath, `${JSON.stringify(packageManifest, null, 2)}\n`);
}

function toJavaScriptPath(sourcePath: string): string {
  return sourcePath.replace(/\.ts$/, ".js");
}

const releaseVersion = (process.argv[2] ?? "").replace(/^v/, "");
if (!releaseVersionPattern.test(releaseVersion)) {
  console.error(`The release tag should be a version like v1.2.0, got "${process.argv[2] ?? ""}"`);
  process.exit(1);
}

const compiledSources = [
  ...globSync("packages/slidemachina/{server-runtime,shared-between-runtimes}/**/*.ts", { cwd: workspaceFolder }),
  "packages/create-slidemachina/create-project.ts",
];
execFileSync(path.join(workspaceFolder, "node_modules", ".bin", "tsc"), [...compilerFlags, ...compiledSources], { cwd: workspaceFolder, stdio: "inherit" });

updateManifest("packages/slidemachina/package.json", (packageManifest) => {
  packageManifest.version = releaseVersion;
  packageManifest.bin = Object.fromEntries(Object.entries(packageManifest.bin).map(([binName, binPath]) => [binName, toJavaScriptPath(binPath)]));
});
updateManifest("packages/create-slidemachina/package.json", (packageManifest) => {
  packageManifest.version = releaseVersion;
  packageManifest.bin = Object.fromEntries(Object.entries(packageManifest.bin).map(([binName, binPath]) => [binName, toJavaScriptPath(binPath)]));
  packageManifest.files = packageManifest.files?.map(toJavaScriptPath);
});
updateManifest("packages/create-slidemachina/template/package.json", (packageManifest) => {
  packageManifest.dependencies = { ...packageManifest.dependencies, slidemachina: `^${releaseVersion}` };
});

// The npm page shows the README of the package folder. Paths in the repository README point into the repository,
// so on npm they lead to the files of this very release on GitHub.
const releaseTag = process.argv[2]!;
const pictureBase = `https://raw.githubusercontent.com/${repositoryName}/${releaseTag}/`;
const pageBase = `https://github.com/${repositoryName}/blob/${releaseTag}/`;
const packageReadme = readFileSync(path.join(workspaceFolder, "README.md"), "utf8")
  .replace(/src="(?!https?:|#)([^"]+)"/g, (_, picturePath: string) => `src="${pictureBase}${picturePath}"`)
  .replace(/href="(?!https?:|#)([^"]+)"/g, (_, linkedPath: string) => `href="${pageBase}${linkedPath}"`)
  .replace(/\]\((?!https?:|#)([^)]+)\)/g, (_, linkedPath: string) => `](${pageBase}${linkedPath})`);
for (const packageFolder of ["packages/slidemachina", "packages/create-slidemachina"]) {
  writeFileSync(path.join(workspaceFolder, packageFolder, "README.md"), packageReadme);
  copyFileSync(path.join(workspaceFolder, "LICENSE"), path.join(workspaceFolder, packageFolder, "LICENSE"));
}
console.log(`Prepared slidemachina and create-slidemachina ${releaseVersion}: ${compiledSources.length} files compiled to JavaScript`);
