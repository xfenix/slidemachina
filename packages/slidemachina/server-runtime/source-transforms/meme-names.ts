import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { commandLineTexts } from "../command-line/command-line-texts.ts";
import { memeFolderParts } from "../meme-sources/memegen-config.ts";
import { findAttribute } from "./syntax-tree.ts";
import type MagicString from "magic-string";
import type { SyntaxNode } from "./syntax-tree.ts";

// A name has no dot and no slash, so a path or a web address keeps working as before.
const memeNamePattern = /^[\p{L}\d][\p{L}\d_-]*$/u;
const memePictureExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg"];
const importNamePrefix = "slidemachinaNamedMeme";

function listMemeNames(memeFolder: string): string[] {
  if (!existsSync(memeFolder)) return [];
  return readdirSync(memeFolder)
    .filter((fileName) => memePictureExtensions.includes(path.extname(fileName).toLowerCase()))
    .map((fileName) => path.basename(fileName, path.extname(fileName)));
}

// <Meme src="fine"> takes images/memes/fine.jpg of the presentation: a picture by its name, without an import.
export function importNamedMemes(memeElements: SyntaxNode[], presentationFolder: string, editedSource: MagicString, reportProblem: (problemText: string) => never): void {
  const memeFolder = path.join(presentationFolder, ...memeFolderParts);
  memeElements.forEach((memeElement, memeIndex) => {
    const sourceValue = findAttribute(memeElement, "src")?.value;
    if (sourceValue?.type !== "Literal" || typeof sourceValue.value !== "string" || !memeNamePattern.test(sourceValue.value)) return;
    const memeName: string = sourceValue.value;
    const picturePath = memePictureExtensions.map((pictureExtension) => path.join(memeFolder, `${memeName}${pictureExtension}`)).find((candidatePath) => existsSync(candidatePath));
    if (picturePath === undefined) reportProblem(commandLineTexts.missingMeme(memeName, listMemeNames(memeFolder)));
    const importName = `${importNamePrefix}${memeIndex}`;
    editedSource.prepend(`import ${importName} from ${JSON.stringify(picturePath)};`);
    editedSource.overwrite(sourceValue.start, sourceValue.end, `{${importName}}`);
  });
}
