import { readFileSync } from "node:fs";
import { commandLineTexts } from "../command-line/command-line-texts.ts";
import { findEngineNames, parseSlideSource } from "./syntax-tree.ts";
import type MagicString from "magic-string";
import type { SyntaxNode } from "./syntax-tree.ts";

type EmbeddedStyles = { stylesText: string; stylesStatements: SyntaxNode[] };

// The id ends in .css, so Vite and Tailwind treat it as a stylesheet next to the slides: imports and url() resolve from that folder.
const embeddedStylesheetSuffix = ".css";

function readTagName(tagNode: SyntaxNode): string | undefined {
  if (tagNode.type === "Identifier") return tagNode.name;
  if (tagNode.type === "MemberExpression" && tagNode.object.type === "Identifier" && tagNode.property.type === "Identifier") return `${tagNode.object.name}.${tagNode.property.name}`;
  return undefined;
}

// Top-level css`…` statements of a slide file: `Machina.css` with the namespace import, `css` with a named one.
function findEmbeddedStyles(syntaxTree: SyntaxNode, filePath: string): EmbeddedStyles {
  const cssTagName = findEngineNames(syntaxTree).css;
  const stylesStatements: SyntaxNode[] = syntaxTree.body.filter(
    (statementNode: SyntaxNode) =>
      statementNode.type === "ExpressionStatement" && statementNode.expression.type === "TaggedTemplateExpression" && readTagName(statementNode.expression.tag) === cssTagName,
  );
  const stylesParts = stylesStatements.map((statementNode) => {
    const styleTemplate = statementNode.expression.quasi;
    if (styleTemplate.expressions.length > 0) throw new Error(commandLineTexts.embeddedStylesWithExpressions(filePath));
    return styleTemplate.quasis[0].value.cooked as string;
  });
  return { stylesText: stylesParts.join("\n"), stylesStatements };
}

export function nameEmbeddedStylesheet(filePath: string): string {
  return `${filePath}${embeddedStylesheetSuffix}`;
}

// The slide file the stylesheet id came from, if it is one of ours.
export function findStylesSourceFile(moduleId: string, isSlideSourceFile: (filePath: string) => boolean): string | undefined {
  if (!moduleId.endsWith(embeddedStylesheetSuffix)) return undefined;
  const sourceFile = moduleId.slice(0, -embeddedStylesheetSuffix.length);
  return isSlideSourceFile(sourceFile) ? sourceFile : undefined;
}

// Read from disk, not from the last transform: after an edit the browser asks for the slides and their styles at the same time.
export function loadEmbeddedStyles(sourceFile: string): string {
  return findEmbeddedStyles(parseSlideSource(readFileSync(sourceFile, "utf8"), sourceFile), sourceFile).stylesText;
}

// The css`…` statements leave the slide file, an import of their stylesheet takes their place.
export function moveEmbeddedStyles(syntaxTree: SyntaxNode, filePath: string, editedSource: MagicString): void {
  const { stylesStatements } = findEmbeddedStyles(syntaxTree, filePath);
  for (const statementNode of stylesStatements) editedSource.remove(statementNode.start, statementNode.end);
  if (stylesStatements.length > 0) editedSource.append(`\nimport ${JSON.stringify(nameEmbeddedStylesheet(filePath))};`);
}
