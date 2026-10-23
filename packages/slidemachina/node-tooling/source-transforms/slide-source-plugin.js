import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import MagicString from "magic-string";
import { commandLineTexts } from "../command-line/command-line-texts.js";
import { highlightCode } from "./code-highlighting.js";
import { readSettingsFor } from "./presentation-settings.js";
import { isSlideSourceFile } from "../presentation-repository/presentation-repository.js";
import { installSourceEditing } from "../development-server/source-editing/source-edit-server.js";
import { markSourceLocations } from "./source-marking.js";
import { typographSyntaxNode } from "./slide-typography.js";
import { findEngineNames, parseSlideSource, readElementName, readStringAttribute, walkSyntaxTree } from "./syntax-tree.js";
import { cookJsxText } from "./text-typography.js";

/** @typedef {import("./syntax-tree.js").SyntaxNode} SyntaxNode */

/**
 * @param {SyntaxNode} codeElement
 * @returns {string | undefined}
 */
function readCodeText(codeElement) {
  for (const childNode of codeElement.children) {
    if (childNode.type === "JSXExpressionContainer") {
      const codeExpression = childNode.expression;
      if (codeExpression.type === "TemplateLiteral" && codeExpression.expressions.length === 0) return codeExpression.quasis[0].value.cooked;
      if (codeExpression.type === "Literal" && typeof codeExpression.value === "string") return codeExpression.value;
    }
    if (childNode.type === "JSXText" && childNode.value.trim() !== "") return cookJsxText(childNode.value);
  }
  return undefined;
}

/**
 * @param {SyntaxNode} codeElement
 * @param {string} filePath
 * @param {import("vite").Rollup.TransformPluginContext} pluginContext
 * @param {(codeFilePath: string) => void} rememberCodeFile
 */
async function highlightCodeElement(codeElement, filePath, pluginContext, rememberCodeFile) {
  const codeFileSource = readStringAttribute(codeElement, "src");
  let codeText = readCodeText(codeElement);
  let languageName = readStringAttribute(codeElement, "lang");
  if (codeFileSource !== undefined) {
    const codeFilePath = path.resolve(path.dirname(filePath), codeFileSource);
    if (!existsSync(codeFilePath)) pluginContext.error(commandLineTexts.missingCodeFile(codeFilePath));
    pluginContext.addWatchFile(codeFilePath);
    rememberCodeFile(codeFilePath);
    codeText = readFileSync(codeFilePath, "utf8");
    languageName ??= path.extname(codeFilePath).slice(1);
  }
  if (codeText === undefined) return undefined;
  return highlightCode(codeText, languageName ?? "text");
}

// Build-time pass over the slide sources: highlights <Code> with Shiki and typographs the text on slides.
/**
 * @param {import("../presentation-repository/presentation-repository.js").SiteLayout} siteLayout
 * @returns {import("vite").Plugin}
 */
export function slideSourcePlugin(siteLayout) {
  const { rootFolder } = siteLayout;
  /** @type {Map<string, Set<string>>} */
  const slideFilesByCodeFile = new Map();
  let marksSourceLocations = false;

  return {
    name: "slidemachina-slide-source",
    enforce: "pre",
    // Marks and the edit endpoint serve the in-browser editor, so only slidemachina dev gets them.
    configResolved(resolvedConfiguration) {
      marksSourceLocations = resolvedConfiguration.command === "serve";
    },
    configureServer(developmentServer) {
      installSourceEditing(developmentServer, siteLayout);
    },
    async transform(sourceCode, moduleId) {
      const filePath = moduleId.split("?")[0];
      if (!isSlideSourceFile(siteLayout, filePath)) return undefined;

      const syntaxTree = parseSlideSource(sourceCode, filePath);
      const presentationSettings = readSettingsFor(filePath, syntaxTree, siteLayout);
      const transformContext = {
        editedSource: new MagicString(sourceCode),
        sourceCode,
        engineNames: findEngineNames(syntaxTree),
        presentationSettings,
      };
      /** @type {SyntaxNode[]} */
      const codeElements = [];
      walkSyntaxTree(syntaxTree, (syntaxNode, ancestorNodes) => {
        if (syntaxNode.type === "JSXElement" && readElementName(syntaxNode) === transformContext.engineNames.Code) codeElements.push(syntaxNode);
        if (presentationSettings.usesTypography) typographSyntaxNode(syntaxNode, ancestorNodes, transformContext);
      });

      const rememberCodeFile = (/** @type {string} */ codeFilePath) => {
        const slideFiles = slideFilesByCodeFile.get(codeFilePath) ?? new Set();
        slideFilesByCodeFile.set(codeFilePath, slideFiles.add(filePath));
      };
      if (marksSourceLocations) {
        const relativeFile = path.relative(rootFolder, filePath).split(path.sep).join("/");
        markSourceLocations(syntaxTree, transformContext.editedSource, sourceCode, relativeFile, transformContext.engineNames);
      }
      for (const codeElement of codeElements) {
        const highlightedCode = await highlightCodeElement(codeElement, filePath, this, rememberCodeFile);
        if (highlightedCode === undefined) continue;
        transformContext.editedSource.appendLeft(codeElement.openingElement.name.end, ` highlightedCode={${JSON.stringify(highlightedCode)}}`);
      }
      return {
        code: transformContext.editedSource.toString(),
        map: transformContext.editedSource.generateMap({ hires: true, source: filePath }),
      };
    },
    // An edited example file re-highlights the slides that show it, without a page reload.
    hotUpdate({ file: changedFile }) {
      const slideFiles = slideFilesByCodeFile.get(changedFile);
      if (slideFiles === undefined) return undefined;
      const slideModules = [...slideFiles].flatMap((slideFile) => [...(this.environment.moduleGraph.getModulesByFile(slideFile) ?? [])]);
      for (const slideModule of slideModules) this.environment.moduleGraph.invalidateModule(slideModule);
      return slideModules;
    },
  };
}
