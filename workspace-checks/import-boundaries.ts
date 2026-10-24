// Fails when a module imports across a boundary of the engine layout described in docs/slidemachina.md.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const enginePackageFolder = fileURLToPath(new URL("../packages/slidemachina", import.meta.url));
const blockFolderSuffix = "-blocks";
const specifierPatterns = [
  /\bfrom\s+["']([^"']+)["']/g,
  /\bimport\s+["']([^"']+)["']/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  /@import\s+["']([^"']+)["']/g,
];

function listModuleFiles(folderPath: string): string[] {
  return readdirSync(folderPath, { withFileTypes: true }).flatMap((directoryEntry) => {
    const entryPath = path.join(folderPath, directoryEntry.name);
    if (directoryEntry.isDirectory()) return directoryEntry.name === "node_modules" ? [] : listModuleFiles(entryPath);
    return /\.(ts|tsx|js|css)$/.test(directoryEntry.name) ? [entryPath] : [];
  });
}

function listSpecifiers(modulePath: string): string[] {
  const moduleText = readFileSync(modulePath, "utf8");
  return specifierPatterns.flatMap((specifierPattern) => [...moduleText.matchAll(specifierPattern)].map((specifierMatch) => specifierMatch[1]));
}

// "browser-runtime/diagram-blocks/…" → ["browser-runtime", "diagram-blocks"].
function describeLocation(absolutePath: string): { runtimeFolder: string, featureFolder: string } {
  const [runtimeFolder = "", featureFolder = ""] = path.relative(enginePackageFolder, absolutePath).split(path.sep);
  return { runtimeFolder, featureFolder };
}

function findBrokenRule(
  importingLocation: { runtimeFolder: string, featureFolder: string },
  specifierText: string,
  importedLocation: { runtimeFolder: string, featureFolder: string } | undefined,
): string | undefined {
  if (importedLocation === undefined) {
    const isNodeBuiltin = specifierText.startsWith("node:");
    if (importingLocation.runtimeFolder === "browser-runtime" && isNodeBuiltin) return "браузерный код не берёт модули Node";
    if (importingLocation.runtimeFolder === "shared-between-runtimes") return "общий код не зависит от пакетов";
    return undefined;
  }
  if (importingLocation.runtimeFolder === "shared-between-runtimes" && importedLocation.runtimeFolder !== "shared-between-runtimes") {
    return "общий код не зависит от остального движка";
  }
  if (importingLocation.runtimeFolder === "browser-runtime" && importedLocation.runtimeFolder === "server-runtime") return "браузерный код не берёт серверный";
  if (importingLocation.runtimeFolder === "server-runtime" && importedLocation.runtimeFolder === "browser-runtime") return "серверный код не берёт браузерные модули";
  if (importingLocation.runtimeFolder !== "browser-runtime" || importedLocation.runtimeFolder !== "browser-runtime") return undefined;
  const importsBlock = importedLocation.featureFolder.endsWith(blockFolderSuffix);
  if (importingLocation.featureFolder === "presentation-core" && importsBlock) return "ядро не зависит от блоков";
  if (importingLocation.featureFolder.endsWith(blockFolderSuffix) && importsBlock && importedLocation.featureFolder !== importingLocation.featureFolder) {
    return "блоки не зависят друг от друга";
  }
  return undefined;
}

const brokenImports = listModuleFiles(enginePackageFolder).flatMap((modulePath) => {
  const importingLocation = describeLocation(modulePath);
  return listSpecifiers(modulePath).flatMap((specifierText) => {
    const isRelative = specifierText.startsWith(".");
    const importedPath = isRelative ? path.resolve(path.dirname(modulePath), specifierText.split("?")[0]) : undefined;
    const importedLocation = importedPath === undefined ? undefined : describeLocation(importedPath);
    const brokenRule = findBrokenRule(importingLocation, specifierText, importedLocation);
    return brokenRule === undefined ? [] : [`${path.relative(enginePackageFolder, modulePath)}: ${specifierText} — ${brokenRule}`];
  });
});

if (brokenImports.length > 0) {
  console.error(`Импорты нарушают раскладку движка (${brokenImports.length}):\n${brokenImports.join("\n")}`);
  process.exit(1);
}
