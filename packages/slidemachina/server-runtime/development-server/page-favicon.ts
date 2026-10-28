import { readFileSync } from "node:fs";
import { engineFaviconAttribute } from "../../shared-between-runtimes/engine-constants.ts";

// The slidemachina mark: SVG with a lighter gradient for dark browsers, PNG for browsers without SVG icons, a 180 px tile for Apple devices.
const vectorFavicon = readFileSync(new URL("./slidemachina-favicon.svg", import.meta.url), "utf8");
const pixelFavicon = readFileSync(new URL("./slidemachina-favicon-32.png", import.meta.url)).toString("base64");
const appleTouchIcon = readFileSync(new URL("./slidemachina-touch-icon.png", import.meta.url)).toString("base64");

// Data URLs work the same in dev, in one file, in a folder and on the list page.
export const faviconLinks = [
  `<link rel="icon" href="data:image/png;base64,${pixelFavicon}" sizes="32x32" ${engineFaviconAttribute} />`,
  `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(vectorFavicon)}" type="image/svg+xml" ${engineFaviconAttribute} />`,
  `<link rel="apple-touch-icon" href="data:image/png;base64,${appleTouchIcon}" ${engineFaviconAttribute} />`,
].join("\n    ");
