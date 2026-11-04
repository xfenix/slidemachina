import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pageFileName } from "./page-serving.ts";
import type { Plugin } from "vite";

const linkTagPattern = /<link\b[^>]*>/g;
const hrefAttributePattern = /href="([^"]+)"/;
const cssUrlCallPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const alreadyResolvedUrlStartPattern = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i;
const percentEscapeSign = "%";
const fontFileExtension = ".woff2";
const leadingCurrentFolderPattern = /^\.\//;
const styleElementCloseSequence = "</style";

// The folder page shows its painted cover before scripts run: an inline stylesheet and preloaded fonts paint it without a stylesheet round trip.
export function createInlineBuiltAssetsPlugin(buildFolder: string): Plugin {
  return {
    name: "slidemachina-inline-built-assets",
    closeBundle() {
      const pagePath = path.join(buildFolder, pageFileName);
      if (existsSync(pagePath)) inlineStylesheetsIntoPage(pagePath);
    },
  };
}

function inlineStylesheetsIntoPage(pagePath: string): void {
  const pageHtml = readFileSync(pagePath, "utf8");
  const inlineReplacements = new Map<string, string>();
  for (const linkMatch of pageHtml.matchAll(linkTagPattern)) {
    const linkTag = linkMatch[0];
    if (!linkTag.includes('rel="stylesheet"') || inlineReplacements.has(linkTag)) continue;
    const stylesheetHref = hrefAttributePattern.exec(linkTag)?.[1];
    if (stylesheetHref === undefined) continue;
    const stylesheetPath = path.join(path.dirname(pagePath), stylesheetHref);
    if (!existsSync(stylesheetPath)) continue;
    const stylesheetFolder = `${path.posix.dirname(stylesheetHref)}/`;
    const rebasedCssText = rebaseRelativeUrls(readFileSync(stylesheetPath, "utf8"), stylesheetFolder);
    const fontPreloadTags = listRebasedFontUrls(rebasedCssText).map(createFontPreloadTag);
    inlineReplacements.set(linkTag, [...fontPreloadTags, createInlineStyleTag(rebasedCssText)].filter((replacementPart) => replacementPart !== "").join("\n    "));
    rmSync(stylesheetPath);
  }
  if (inlineReplacements.size === 0) return;
  let rebuiltPageHtml = pageHtml;
  for (const [linkTag, inlineReplacement] of inlineReplacements) rebuiltPageHtml = rebuiltPageHtml.replace(linkTag, () => inlineReplacement);
  writeFileSync(pagePath, rebuiltPageHtml);
}

// A relative url() used to resolve against the stylesheet file; inline in the page it resolves against the page itself.
function rebaseRelativeUrls(cssText: string, stylesheetFolder: string): string {
  return cssText.replace(cssUrlCallPattern, (urlCall: string, urlQuotes: string, urlTarget: string) => {
    if (alreadyResolvedUrlStartPattern.test(urlTarget) || urlTarget.includes(percentEscapeSign)) return urlCall;
    return `url(${urlQuotes}${stylesheetFolder}${urlTarget.replace(leadingCurrentFolderPattern, "")}${urlQuotes})`;
  });
}

function listRebasedFontUrls(cssText: string): string[] {
  const fontUrls = new Set<string>();
  for (const urlMatch of cssText.matchAll(cssUrlCallPattern)) {
    const urlTarget = urlMatch[2]!;
    if (urlTarget.toLowerCase().endsWith(fontFileExtension)) fontUrls.add(urlTarget);
  }
  return [...fontUrls];
}

function createFontPreloadTag(fontHref: string): string {
  return `<link rel="preload" as="font" type="font/woff2" crossorigin href="${fontHref}" />`;
}

// Inside an inline <style> a "</style>" in the text would end the element early: an escaped slash keeps the CSS valid.
function createInlineStyleTag(cssText: string): string {
  return `<style>${cssText.replaceAll(styleElementCloseSequence, "<\\/style")}</style>`;
}
