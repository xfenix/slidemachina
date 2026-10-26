import path from "node:path";
import { memeFontStylesheet } from "../development-server/entry-modules.ts";
import { toImportPath } from "../development-server/media-files.ts";
import { memeConfigFileName, readTemplateFiles } from "../meme-sources/memegen-config.ts";
import { ensureMemeTemplate } from "../meme-sources/memegen-templates.ts";
import { commandLineTexts } from "../command-line/command-line-texts.ts";
import { findAttribute, readStringAttribute } from "./syntax-tree.ts";
import type { SyntaxNode } from "./syntax-tree.ts";
import type MagicString from "magic-string";
import type { Rollup } from "vite";

type MemeInjection = {
  memeElements: SyntaxNode[],
  filePath: string,
  presentationFolder: string,
  editedSource: MagicString,
  rememberWatchedFile: (watchedFilePath: string) => void,
};

// <Meme animated> and animated={true} ask for the GIF; animated={false} or no attribute for the still picture.
function readAnimatedFlag(memeElement: SyntaxNode): boolean {
  const animatedAttribute = findAttribute(memeElement, "animated");
  if (animatedAttribute === undefined) return false;
  return animatedAttribute.value === null || animatedAttribute.value.expression?.value !== false;
}

// Each <Meme template> gets its picture as an import and its caption fields from config.yml; a missing template is downloaded first.
export async function injectMemeTemplates(memeInjection: MemeInjection, pluginContext: Rollup.TransformPluginContext): Promise<void> {
  const { memeElements, filePath, presentationFolder, editedSource, rememberWatchedFile } = memeInjection;
  for (const [memeIndex, memeElement] of memeElements.entries()) {
    const templateId = readStringAttribute(memeElement, "template");
    if (templateId === undefined) pluginContext.error(commandLineTexts.memeTemplateExpression);
    const isAnimated = readAnimatedFlag(memeElement);
    let templateFiles;
    try {
      const templateFolder = await ensureMemeTemplate(presentationFolder, templateId, isAnimated);
      rememberWatchedFile(path.join(templateFolder, memeConfigFileName));
      templateFiles = await readTemplateFiles(templateFolder, isAnimated);
    } catch (templateError) {
      pluginContext.error(commandLineTexts.memeTemplateFailed(templateId, templateError instanceof Error ? templateError.message : String(templateError)));
    }
    if (templateFiles === undefined) pluginContext.error(commandLineTexts.memeTemplateFailed(templateId, templateId));
    const pictureImportName = `slidemachinaMemePicture${memeIndex}`;
    editedSource.prepend(`import ${pictureImportName} from ${JSON.stringify(toImportPath(path.dirname(filePath), templateFiles.picturePath))};`);
    const { pictureWidth, pictureHeight, memegenConfig } = templateFiles;
    const templateLayout = { templateName: memegenConfig.templateName, pictureWidth, pictureHeight, captionFields: memegenConfig.captionFields };
    editedSource.appendLeft(memeElement.openingElement.name.end, ` memeTemplate={{ ...${JSON.stringify(templateLayout)}, pictureAddress: ${pictureImportName} }}`);
  }
  // The caption font is loaded only by presentations with memes: a one-file build of any other carries no extra font.
  if (memeElements.length > 0) editedSource.prepend(`import ${JSON.stringify(memeFontStylesheet)};`);
}
