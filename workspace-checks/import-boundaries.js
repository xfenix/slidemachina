// Fails when a module imports across a boundary of the engine layout described in docs/slidemachina.md.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const enginePackageFolder = fileURLToPath(new URL("../packages/slidemachina", import.meta.url));
const blockFolders = ["content-blocks", "code-blocks", "diagram-blocks", "scene-blocks"];
const specifierPatterns = [
  /\bfrom\s+["']([^"']+)["']/g,
  /\bimport\s+["']([^"']+)["']/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  /@import\s+["']([^"']+)["']/g,
];

/** @param {string} folderPath @returns {string[]} */
function listModuleFiles(folderPath) {
  return readdirSync(folderPath, { withFileTypes: true }).flatMap((directoryEntry) => {
    const entryPath = path.join(folderPath, directoryEntry.name);
    if (directoryEntry.isDirectory()) return directoryEntry.name === "node_modules" ? [] : listModuleFiles(entryPath);
    return /\.(ts|tsx|js|css)$/.test(directoryEntry.name) ? [entryPath] : [];
  });
}

/** @param {string} modulePath @returns {string[]} */
function listSpecifiers(modulePath) {
  const moduleText = readFileSync(modulePath, "utf8");
  return specifierPatterns.flatMap((specifierPattern) => [...moduleText.matchAll(specifierPattern)].map((specifierMatch) => specifierMatch[1]));
}

// "browser-runtime/diagram-blocks/…" → ["browser-runtime", "diagram-blocks"].
/** @param {string} absolutePath */
function describeLocation(absolutePath) {
  const [runtimeFolder = "", featureFolder = ""] = path.relative(enginePackageFolder, absolutePath).split(path.sep);
  return { runtimeFolder, featureFolder };
}

/**
 * @param {{ runtimeFolder: string, featureFolder: string }} importingLocation
 * @param {string} specifierText
 * @param {{ runtimeFolder: string, featureFolder: string } | undefined} importedLocation
 */
function findBrokenRule(importingLocation, specifierText, importedLocation) {
  if (importedLocation === undefined) {
    const isNodeBuiltin = specifierText.startsWith("node:");
    if (importingLocation.runtimeFolder === "browser-runtime" && isNodeBuiltin) return "браузерный код не берёт модули Node";
    if (importingLocation.runtimeFolder === "shared-between-runtimes") return "общий код не зависит от пакетов";
    return undefined;
  }
  if (importingLocation.runtimeFolder === "shared-between-runtimes" && importedLocation.runtimeFolder !== "shared-between-runtimes") {
    return "общий код не зависит от остального движка";
  }
  if (importingLocation.runtimeFolder === "browser-runtime" && importedLocation.runtimeFolder === "node-tooling") return "браузерный код не берёт код Node";
  if (importingLocation.runtimeFolder === "node-tooling" && importedLocation.runtimeFolder === "browser-runtime") return "код Node не берёт браузерные модули";
  if (importingLocation.runtimeFolder !== "browser-runtime" || importedLocation.runtimeFolder !== "browser-runtime") return undefined;
  const importsBlock = blockFolders.includes(importedLocation.featureFolder);
  if (importingLocation.featureFolder === "presentation-core" && importsBlock) return "ядро не зависит от блоков";
  if (blockFolders.includes(importingLocation.featureFolder) && importsBlock && importedLocation.featureFolder !== importingLocation.featureFolder) {
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
