import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * @typedef {object} SiteLayout
 * @property {string} rootFolder
 * @property {boolean} isRepository
 * @property {string | undefined} themeStylesheet
 * @property {string} [listAddress]
 */

export const presentationFileName = "index.tsx";
const themeFolderName = "theme";
const skippedFolderNames = new Set(["node_modules", "dist", themeFolderName]);

// A repository keeps presentation folders side by side, each with its own index.tsx; theme/style.css is shared by all of them.
/** @param {string} repositoryFolder */
export function listPresentationFolders(repositoryFolder) {
  return readdirSync(repositoryFolder, { withFileTypes: true })
    .filter((folderEntry) => folderEntry.isDirectory() && !/^[._]/.test(folderEntry.name) && !skippedFolderNames.has(folderEntry.name))
    .map((folderEntry) => path.join(repositoryFolder, folderEntry.name))
    .filter((presentationFolder) => existsSync(path.join(presentationFolder, presentationFileName)));
}

/** @param {string} repositoryFolder */
function findThemeStylesheet(repositoryFolder) {
  const themeStylesheet = path.join(repositoryFolder, themeFolderName, "style.css");
  return existsSync(themeStylesheet) ? themeStylesheet : undefined;
}

// A presentation inside a repository takes the shared theme even when it is opened alone.
/**
 * @param {string} chosenFolder
 * @returns {SiteLayout | undefined}
 */
export function describeSite(chosenFolder) {
  if (existsSync(path.join(chosenFolder, presentationFileName))) {
    return { rootFolder: chosenFolder, isRepository: false, themeStylesheet: findThemeStylesheet(path.dirname(chosenFolder)) };
  }
  const isRepository = findThemeStylesheet(chosenFolder) !== undefined || listPresentationFolders(chosenFolder).length > 0;
  return isRepository ? { rootFolder: chosenFolder, isRepository, themeStylesheet: findThemeStylesheet(chosenFolder) } : undefined;
}

// Paths compared here are real paths: the command line resolves links, and Vite reports real file paths.
/**
 * @param {string} parentFolder
 * @param {string} checkedPath
 */
export function isInsideFolder(parentFolder, checkedPath) {
  const relativePath = path.relative(parentFolder, checkedPath);
  return relativePath !== "" && relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
}

// The plugin reads and the editor writes only these files: .jsx and .tsx of the site itself, not of its dependencies.
/**
 * @param {SiteLayout} siteLayout
 * @param {string} filePath
 */
export function isSlideSourceFile(siteLayout, filePath) {
  const relativePath = path.relative(siteLayout.rootFolder, filePath);
  return /\.[jt]sx$/.test(filePath) && isInsideFolder(siteLayout.rootFolder, filePath) && !relativePath.split(path.sep).includes("node_modules");
}

// The presentation a slide file belongs to: it decides the language of the typographer and where new pictures go.
/**
 * @param {SiteLayout} siteLayout
 * @param {string} filePath
 */
export function findPresentationFolder(siteLayout, filePath) {
  const relativePath = path.relative(siteLayout.rootFolder, filePath);
  if (relativePath !== "" && !isInsideFolder(siteLayout.rootFolder, filePath)) return undefined;
  if (!siteLayout.isRepository) return siteLayout.rootFolder;
  const presentationFolder = path.join(siteLayout.rootFolder, relativePath.split(path.sep)[0]);
  return existsSync(path.join(presentationFolder, presentationFileName)) ? presentationFolder : undefined;
}

// "" for the one presentation at the site root, "/talk" for a presentation of a repository.
/**
 * @param {SiteLayout} siteLayout
 * @param {string} presentationFolder
 */
export function toSitePath(siteLayout, presentationFolder) {
  const relativePath = path.relative(siteLayout.rootFolder, presentationFolder).split(path.sep).join("/");
  return relativePath === "" ? "" : `/${relativePath}`;
}
