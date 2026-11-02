// Packs the slidemachina package straight from this repository for the benchmark run.
// The release compiles the command-line code to JavaScript before publishing: Node does not strip types under node_modules.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const workspaceFolder = path.resolve(import.meta.dirname, "..");
const compiledFolderNames = ["server-runtime", "shared-between-runtimes"];
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

function listFilesRecursively(folderPath: string): string[] {
  const foundFiles: string[] = [];
  for (const folderEntry of readdirSync(folderPath, { withFileTypes: true })) {
    const entryPath = path.join(folderPath, folderEntry.name);
    if (folderEntry.isDirectory()) foundFiles.push(...listFilesRecursively(entryPath));
    else if (folderEntry.isFile()) foundFiles.push(entryPath);
  }
  return foundFiles;
}

// A stale .js next to a .ts, as a local release prep leaves it, would ship instead of a fresh compile.
function removeStaleJavaScript(packageFolder: string): void {
  for (const compiledFolderName of compiledFolderNames) {
    const compiledFolder = path.join(packageFolder, compiledFolderName);
    if (!existsSync(compiledFolder)) continue;
    for (const compiledFile of listFilesRecursively(compiledFolder)) {
      if (compiledFile.endsWith(".js")) rmSync(compiledFile);
    }
  }
}

// The same step as the release workflow: compile, point the bin at the JavaScript, pack. Returns the tarball path.
export function packRepositoryPackage(packingFolder: string): string {
  const packageFolder = path.join(packingFolder, "slidemachina-repository");
  cpSync(path.join(workspaceFolder, "packages", "slidemachina"), packageFolder, { recursive: true });
  removeStaleJavaScript(packageFolder);
  const typeScriptSources = compiledFolderNames.flatMap((compiledFolderName) =>
    listFilesRecursively(path.join(packageFolder, compiledFolderName)).filter((compiledFile) => compiledFile.endsWith(".ts")),
  );
  execFileSync(path.join(workspaceFolder, "node_modules", ".bin", "tsc"), [...compilerFlags, ...typeScriptSources], { cwd: packageFolder, stdio: "inherit" });
  const manifestPath = path.join(packageFolder, "package.json");
  const packageManifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bin: Record<string, string> };
  packageManifest.bin = Object.fromEntries(Object.entries(packageManifest.bin).map(([binName, binPath]) => [binName, binPath.replace(/\.ts$/, ".js")]));
  writeFileSync(manifestPath, `${JSON.stringify(packageManifest, null, 2)}\n`);
  const packedFileName = execFileSync("npm", ["pack", "--silent"], { cwd: packageFolder, encoding: "utf8" }).trim().split("\n").at(-1)!;
  const tarballPath = path.join(packageFolder, packedFileName);
  if (!statSync(tarballPath).isFile()) throw new Error(`npm pack did not produce ${tarballPath}`);
  return tarballPath;
}
