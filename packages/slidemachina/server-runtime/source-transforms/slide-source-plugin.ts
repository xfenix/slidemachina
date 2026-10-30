import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import MagicString from "magic-string";
import { measureCanvasSize } from "../../shared-between-runtimes/canvas-size.ts";
import { commandLineTexts } from "../command-line/command-line-texts.ts";
import { highlightCodeOnce } from "./code-highlighting.ts";
import { readSettingsFor } from "./presentation-settings.ts";
import { isSlideSourceFile } from "../presentation-repository/presentation-repository.ts";
import { installMemeSearch } from "../development-server/meme-search-server.ts";
import { installSourceEditing } from "../development-server/source-edit-server.ts";
import { memeFontStylesheet } from "../development-server/entry-modules.ts";
import { embedRemoteMedia, findRemoteMedia } from "./remote-media-embedding.ts";
import { findStylesSourceFile, loadEmbeddedStyles, moveEmbeddedStyles, nameEmbeddedStylesheet } from "./embedded-styles.ts";
import { markSourceLocations } from "./source-marking.ts";
import { typographSyntaxNode } from "./slide-typography.ts";
import { findEngineNames, parseSlideSource, readElementName, readStringAttribute, walkSyntaxTree } from "./syntax-tree.ts";
import { cookJsxText } from "./text-typography.ts";
import type { Plugin, Rollup } from "vite";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";
import type { SyntaxNode } from "./syntax-tree.ts";

function readCodeText(codeElement: SyntaxNode): string | undefined {
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

async function highlightCodeElement(
  codeElement: SyntaxNode,
  filePath: string,
  pluginContext: Rollup.TransformPluginContext,
  rememberCodeFile: (codeFilePath: string) => void,
): Promise<unknown> {
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
  return highlightCodeOnce(codeText, languageName ?? "text", codeFileSource !== undefined);
}

// Build-time pass over the slide sources: highlights <Code> with Shiki and typographs the text on slides.
export function createSlideSourcePlugin(siteLayout: SiteLayout): Plugin {
  const { rootFolder } = siteLayout;
  const slideFilesByCodeFile = new Map<string, Set<string>>();
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
      installMemeSearch(developmentServer);
    },
    // css`…` in a slide file becomes "<file>.css": a stylesheet Vite and Tailwind handle like style.css.
    resolveId(importedId) {
      return findStylesSourceFile(importedId, (filePath) => isSlideSourceFile(siteLayout, filePath)) === undefined ? undefined : importedId;
    },
    load(moduleId) {
      const stylesSourceFile = findStylesSourceFile(moduleId, (filePath) => isSlideSourceFile(siteLayout, filePath));
      if (stylesSourceFile === undefined) return undefined;
      this.addWatchFile(stylesSourceFile);
      return loadEmbeddedStyles(stylesSourceFile);
    },
    async transform(sourceCode, moduleId) {
      const filePath = moduleId.replace(/\?.*$/, "");
      if (!isSlideSourceFile(siteLayout, filePath)) return undefined;

      const syntaxTree = parseSlideSource(sourceCode, filePath);
      const presentationSettings = readSettingsFor(filePath, syntaxTree, siteLayout);
      const { aspectRatio } = presentationSettings;
      if (aspectRatio !== undefined && measureCanvasSize(aspectRatio) === undefined) this.error(commandLineTexts.wrongAspectRatio(aspectRatio));
      const transformContext = {
        editedSource: new MagicString(sourceCode),
        sourceCode,
        engineNames: findEngineNames(syntaxTree),
        presentationSettings,
      };
      moveEmbeddedStyles(syntaxTree, filePath, transformContext.editedSource);
      const codeElements: SyntaxNode[] = [];
      const memeElements: SyntaxNode[] = [];
      const remoteMediaPlaces: ReturnType<typeof findRemoteMedia> = [];
      walkSyntaxTree(syntaxTree, (syntaxNode, ancestorNodes) => {
        if (!marksSourceLocations) remoteMediaPlaces.push(...findRemoteMedia(syntaxNode, transformContext.engineNames));
        const elementName = syntaxNode.type === "JSXElement" ? readElementName(syntaxNode) : undefined;
        if (elementName !== undefined && elementName === transformContext.engineNames.Code) codeElements.push(syntaxNode);
        if (elementName !== undefined && elementName === transformContext.engineNames.Meme) memeElements.push(syntaxNode);
        if (presentationSettings.usesTypography) typographSyntaxNode(syntaxNode, ancestorNodes, transformContext);
      });

      const rememberCodeFile = (codeFilePath: string) => {
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
      // Only the build embeds web addresses: slidemachina dev shows them straight from the web.
      await embedRemoteMedia(remoteMediaPlaces, transformContext.editedSource, this);
      // The caption font is loaded only by presentations with memes: a one-file build of any other carries no extra font.
      if (memeElements.length > 0) transformContext.editedSource.prepend(`import ${JSON.stringify(memeFontStylesheet)};`);
      return {
        code: transformContext.editedSource.toString(),
        map: transformContext.editedSource.generateMap({ hires: true, source: filePath }),
      };
    },
    // An edited example file re-highlights the slides that show it without a page reload; an edited slide file also refreshes its css`…`.
    hotUpdate({ file: changedFile, modules: changedModules }) {
      const stylesModule = this.environment.moduleGraph.getModuleById(nameEmbeddedStylesheet(changedFile));
      const slideFiles = [...(slideFilesByCodeFile.get(changedFile) ?? [])];
      const slideModules = slideFiles.flatMap((slideFile) => [...(this.environment.moduleGraph.getModulesByFile(slideFile) ?? [])]);
      const refreshedModules = stylesModule === undefined ? slideModules : [...slideModules, stylesModule];
      if (refreshedModules.length === 0) return undefined;
      for (const refreshedModule of refreshedModules) this.environment.moduleGraph.invalidateModule(refreshedModule);
      return [...changedModules, ...refreshedModules];
    },
  };
}
