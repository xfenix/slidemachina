// A TypeScript language service plugin: hovering <Slide> or <Section> in index.tsx shows the slide number and its address.
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { compileFunction } = require("node:vm");

/** @typedef {typeof import("typescript")} TypeScriptModule */
/** @typedef {import("typescript").JsxElement | import("typescript").JsxSelfClosingElement | import("typescript").JsxFragment | import("typescript").JsxExpression} SlideMarkupNode */
/** @typedef {import("../shared-between-runtimes/slide-outline-rules.ts").SlideOutlineReader<SlideMarkupNode>} SyntaxOutlineReader */

const packageFolder = path.dirname(__dirname).replaceAll("\\", "/");
const hintTextsByLanguage = {
  en: {
    describeSlide: (/** @type {number} */ slideNumber) => `Slide ${slideNumber} · #${slideNumber}`,
    describeSection: (/** @type {string} */ sectionNumber, /** @type {number} */ slideNumber) =>
      `Section ${sectionNumber} · slide ${slideNumber} · #${slideNumber}`,
    unknownNumber: "The number is known only on screen: a {…} above may add slides.",
  },
  ru: {
    describeSlide: (/** @type {number} */ slideNumber) => `Слайд ${slideNumber} · #${slideNumber}`,
    describeSection: (/** @type {string} */ sectionNumber, /** @type {number} */ slideNumber) =>
      `Раздел ${sectionNumber} · слайд ${slideNumber} · #${slideNumber}`,
    unknownNumber: "Номер виден только при показе: {…} выше может добавить слайды.",
  },
};

// Node in an editor runs no TypeScript, so the editor's own TypeScript compiles the shared rules of the engine.
/** @param {TypeScriptModule} typescript @param {string} sharedFileName */
function loadSharedModule(typescript, sharedFileName) {
  const sharedFilePath = path.join(__dirname, "..", "shared-between-runtimes", sharedFileName);
  const compiledSource = typescript.transpileModule(readFileSync(sharedFilePath, "utf8"), {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  compileFunction(compiledSource, ["module", "exports"], { filename: sharedFilePath })(compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

/** @param {{ typescript: TypeScriptModule }} pluginModules */
function initializeSlideNumberHints({ typescript }) {
  const { pickTextLanguage } = /** @type {typeof import("../shared-between-runtimes/text-language.ts")} */ (
    loadSharedModule(typescript, "text-language.ts")
  );
  const { outlineSlideMarkup } = /** @type {typeof import("../shared-between-runtimes/slide-outline-rules.ts")} */ (
    loadSharedModule(typescript, "slide-outline-rules.ts")
  );

  /** @param {import("typescript").JsxElement | import("typescript").JsxSelfClosingElement} markupElement */
  function readOpeningTag(markupElement) {
    return typescript.isJsxElement(markupElement) ? markupElement.openingElement : markupElement;
  }

  /** @param {import("typescript").JsxElement | import("typescript").JsxSelfClosingElement} markupElement @param {string} attributeName */
  function findAttributeValue(markupElement, attributeName) {
    const foundAttribute = readOpeningTag(markupElement).attributes.properties.find(
      (attributeNode) =>
        typescript.isJsxAttribute(attributeNode) && typescript.isIdentifier(attributeNode.name) && attributeNode.name.text === attributeName,
    );
    return foundAttribute && typescript.isJsxAttribute(foundAttribute) ? foundAttribute.initializer : undefined;
  }

  // The page keeps only elements: text, comments and literals in {…} make no slide, any other {…} is unknown until shown.
  /** @param {SlideMarkupNode} markupNode @returns {SlideMarkupNode[]} */
  function listChildMarkup(markupNode) {
    if (!typescript.isJsxElement(markupNode) && !typescript.isJsxFragment(markupNode)) return [];
    return markupNode.children.filter(
      /** @returns {childNode is SlideMarkupNode} */
      (childNode) =>
        typescript.isJsxExpression(childNode)
          ? childNode.expression !== undefined && !isLiteralExpression(childNode.expression)
          : !typescript.isJsxText(childNode),
    );
  }

  /** @param {import("typescript").Expression} expressionNode @returns {import("typescript").Expression} */
  function unwrapParentheses(expressionNode) {
    return typescript.isParenthesizedExpression(expressionNode) ? unwrapParentheses(expressionNode.expression) : expressionNode;
  }

  /** @param {import("typescript").Expression} expressionNode */
  function isLiteralExpression(expressionNode) {
    const unwrappedExpression = unwrapParentheses(expressionNode);
    return (
      typescript.isLiteralExpression(unwrappedExpression) ||
      [typescript.SyntaxKind.NullKeyword, typescript.SyntaxKind.TrueKeyword, typescript.SyntaxKind.FalseKeyword].includes(unwrappedExpression.kind)
    );
  }

  /** @param {import("typescript").TypeChecker} typeChecker @returns {SyntaxOutlineReader & { readComponentName: (tagName: import("typescript").JsxTagNameExpression) => string | undefined }} */
  function createSyntaxOutlineReader(typeChecker) {
    // Only components of this package count, wherever they are imported from; Fragment is React's.
    const readComponentName = (/** @type {import("typescript").JsxTagNameExpression} */ tagName) => {
      const tagSymbol = typeChecker.getSymbolAtLocation(tagName);
      if (tagSymbol === undefined) return undefined;
      const componentSymbol = tagSymbol.flags & typescript.SymbolFlags.Alias ? typeChecker.getAliasedSymbol(tagSymbol) : tagSymbol;
      if (componentSymbol.name === "Fragment") return componentSymbol.name;
      const declarationFile = componentSymbol.declarations?.[0]?.getSourceFile().fileName;
      return declarationFile?.startsWith(`${packageFolder}/`) ? componentSymbol.name : undefined;
    };
    return {
      readComponentName,
      classifyMarkupNode: (markupNode) => {
        if (typescript.isJsxFragment(markupNode)) return "fragment";
        if (typescript.isJsxExpression(markupNode)) return "slide";
        const componentName = readComponentName(readOpeningTag(markupNode).tagName);
        return componentName === "Fragment" ? "fragment" : componentName === "Section" ? "section" : "slide";
      },
      listMarkupChildren: listChildMarkup,
      readSectionCover: (sectionNode) => {
        if (typescript.isJsxFragment(sectionNode) || typescript.isJsxExpression(sectionNode)) return true;
        const coverValue = findAttributeValue(sectionNode, "cover");
        if (coverValue === undefined || !typescript.isJsxExpression(coverValue) || coverValue.expression === undefined) return true;
        const coverExpression = unwrapParentheses(coverValue.expression);
        if (coverExpression.kind === typescript.SyntaxKind.FalseKeyword) return false;
        return typescript.isJsxElement(coverExpression) || typescript.isJsxSelfClosingElement(coverExpression) ? coverExpression : true;
      },
    };
  }

  /** @param {import("typescript").Program} program @param {import("typescript").SourceFile} sourceFile @param {number} cursorPosition */
  function describeHoveredMarkup(program, sourceFile, cursorPosition) {
    const outlineReader = createSyntaxOutlineReader(program.getTypeChecker());
    const isUnderCursor = (/** @type {SlideMarkupNode} */ markupNode) => {
      if (typescript.isJsxFragment(markupNode) || typescript.isJsxExpression(markupNode)) return false;
      const tagName = readOpeningTag(markupNode).tagName;
      return cursorPosition >= tagName.getStart(sourceFile) && cursorPosition <= tagName.getEnd();
    };
    /** @type {import("typescript").JsxElement[]} */
    const presentationElements = [];
    const collectPresentations = (/** @type {import("typescript").Node} */ syntaxNode) => {
      const isPresentation =
        typescript.isJsxElement(syntaxNode) &&
        syntaxNode.openingElement.tagName.getText(sourceFile).endsWith("Presentation") &&
        outlineReader.readComponentName(syntaxNode.openingElement.tagName) === "Presentation";
      if (isPresentation) presentationElements.push(syntaxNode);
      else typescript.forEachChild(syntaxNode, collectPresentations);
    };
    collectPresentations(sourceFile);
    for (const presentationElement of presentationElements) {
      const outlinedSlides = outlineSlideMarkup(listChildMarkup(presentationElement), outlineReader);
      const firstUnknownIndex = outlinedSlides.findIndex((outlinedSlide) => typescript.isJsxExpression(outlinedSlide.slideNode));
      const languageAttribute = findAttributeValue(presentationElement, "lang");
      const languageCode = languageAttribute !== undefined && typescript.isStringLiteral(languageAttribute) ? languageAttribute.text : "en";
      const hintTexts = hintTextsByLanguage[pickTextLanguage(languageCode)];
      const describeSlideAt = (/** @type {number} */ slideIndex, /** @type {(slideNumber: number) => string} */ describeNumber) =>
        firstUnknownIndex !== -1 && slideIndex >= firstUnknownIndex ? hintTexts.unknownNumber : describeNumber(slideIndex + 1);
      // A section is checked first: its generated cover slide points at the same tag.
      for (const [slideIndex, outlinedSlide] of outlinedSlides.entries()) {
        const hoveredSection = outlinedSlide.sectionPlaces.find((sectionPlace) => isUnderCursor(sectionPlace.sectionNode));
        if (hoveredSection !== undefined) {
          return describeSlideAt(slideIndex, (slideNumber) => hintTexts.describeSection(hoveredSection.sectionNumber, slideNumber));
        }
      }
      const hoveredSlideIndex = outlinedSlides.findIndex((outlinedSlide) => isUnderCursor(outlinedSlide.slideNode));
      if (hoveredSlideIndex !== -1) return describeSlideAt(hoveredSlideIndex, hintTexts.describeSlide);
    }
    return undefined;
  }

  return {
    /** @param {import("typescript").server.PluginCreateInfo} pluginCreateInfo @returns {import("typescript").LanguageService} */
    create(pluginCreateInfo) {
      const languageService = pluginCreateInfo.languageService;
      return {
        ...languageService,
        getQuickInfoAtPosition(fileName, cursorPosition, ...remainingArguments) {
          const quickInfo = languageService.getQuickInfoAtPosition(fileName, cursorPosition, ...remainingArguments);
          const program = languageService.getProgram();
          const sourceFile = program?.getSourceFile(fileName);
          if (quickInfo === undefined || program === undefined || sourceFile === undefined) return quickInfo;
          const hintText = describeHoveredMarkup(program, sourceFile, cursorPosition);
          if (hintText === undefined) return quickInfo;
          const originalDocumentation = quickInfo.documentation ?? [];
          const separatedDocumentation = originalDocumentation.length > 0 ? [{ kind: "lineBreak", text: "\n\n" }, ...originalDocumentation] : [];
          return { ...quickInfo, documentation: [{ kind: "text", text: hintText }, ...separatedDocumentation] };
        },
      };
    },
  };
}

module.exports = initializeSlideNumberHints;
