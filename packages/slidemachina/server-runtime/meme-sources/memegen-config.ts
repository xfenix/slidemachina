import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { MemeCaptionField } from "../../shared-between-runtimes/meme-template.ts";

export type MemegenConfig = { templateName: string, sourceAddress: string | undefined, exampleCaptions: string[], captionFields: MemeCaptionField[] };
export type MemeTemplateFiles = { memegenConfig: MemegenConfig, picturePath: string, pictureWidth: number, pictureHeight: number };

// Templates lie in the presentation as memegen keeps them: images/memes/<template>/config.yml and default.jpg, .png or .gif.
export const memeFolderParts = ["images", "memes"];
export const memeConfigFileName = "config.yml";
export const staticPictureNames = ["default.jpg", "default.png"];
export const animatedPictureName = "default.gif";
// memegen's defaults for a field that leaves a key out: a band along the top in thick white capitals.
const defaultFieldWidth = 1;
const defaultFieldHeight = 0.2;

export function findTemplateFolder(presentationFolder: string, templateId: string): string {
  return path.join(presentationFolder, ...memeFolderParts, templateId);
}

// An animated meme takes the GIF and falls back to the still picture; a still one the other way round, as memegen does.
export function listPictureNames(isAnimated: boolean): string[] {
  return isAnimated ? [animatedPictureName, ...staticPictureNames] : [...staticPictureNames, animatedPictureName];
}

export function findTemplatePicture(templateFolder: string, isAnimated: boolean): string | undefined {
  return listPictureNames(isAnimated)
    .map((pictureName) => path.join(templateFolder, pictureName))
    .find((picturePath) => existsSync(picturePath));
}

// A long plain value continues on indented lines; YAML folds each line break into a space.
function unquoteYamlValue(rawValue: string): string {
  const trimmedValue = rawValue.replace(/[ \t]*\n[ \t]*/g, " ").trim();
  if (/^'.*'$/.test(trimmedValue)) return trimmedValue.slice(1, -1).replaceAll("''", "'");
  if (/^".*"$/.test(trimmedValue)) return JSON.parse(trimmedValue) as string;
  return trimmedValue;
}

function readTopLevelValue(configText: string, keyName: string): string | undefined {
  const valueText = new RegExp(`^${keyName}:[ \\t]*(.*(?:\\n[ \\t]+(?![ \\t-])[^\\n]*)*)`, "m").exec(configText)?.[1];
  return valueText === undefined || valueText.trim() === "" ? undefined : unquoteYamlValue(valueText);
}

// Every memegen config has the same flat shape: a top-level key followed by indented "- " items, so no YAML library is needed.
function readListItems(configText: string, keyName: string): string[] {
  const sectionText = new RegExp(`^${keyName}:[^\\n]*\\n((?:[ \\t]+[^\\n]*(?:\\n|$))*)`, "m").exec(configText)?.[1] ?? "";
  return sectionText.split(/^[ \t]*-[ \t]*/m).slice(1);
}

function readItemFields(itemText: string): Map<string, string> {
  const itemLines = itemText.split("\n").flatMap((itemLine) => {
    const lineMatch = /^\s*(\w+):\s*(.*)$/.exec(itemLine);
    return lineMatch === null ? [] : [[lineMatch[1]!, unquoteYamlValue(lineMatch[2]!)] as const];
  });
  return new Map(itemLines);
}

function readCaptionField(itemFields: Map<string, string>): MemeCaptionField {
  const readNumber = (keyName: string, defaultValue: number) => Number(itemFields.get(keyName) ?? defaultValue);
  const textStyle = itemFields.get("style") ?? "upper";
  return {
    fieldLeft: readNumber("anchor_x", 0),
    fieldTop: readNumber("anchor_y", 0),
    fieldWidth: readNumber("scale_x", defaultFieldWidth),
    fieldHeight: readNumber("scale_y", defaultFieldHeight),
    fieldAngle: readNumber("angle", 0),
    textColor: itemFields.get("color") ?? "white",
    letterCase: textStyle === "upper" || textStyle === "lower" ? textStyle : "none",
    textAlign: itemFields.get("align") === "left" ? "left" : "center",
    isThickFont: (itemFields.get("font") ?? "thick") === "thick",
  };
}

export function parseMemegenConfig(configText: string, templateId: string): MemegenConfig {
  return {
    templateName: readTopLevelValue(configText, "name") ?? templateId,
    sourceAddress: readTopLevelValue(configText, "source"),
    exampleCaptions: readListItems(configText, "example").map(unquoteYamlValue),
    captionFields: readListItems(configText, "text").map((itemText) => readCaptionField(readItemFields(itemText))),
  };
}

// Sizes are read from the file header: the slide knows the proportions before the picture loads.
export async function readTemplateFiles(templateFolder: string, isAnimated: boolean): Promise<MemeTemplateFiles | undefined> {
  const configPath = path.join(templateFolder, memeConfigFileName);
  const picturePath = findTemplatePicture(templateFolder, isAnimated);
  if (!existsSync(configPath) || picturePath === undefined) return undefined;
  const pictureMetadata = await sharp(picturePath).metadata();
  return {
    memegenConfig: parseMemegenConfig(readFileSync(configPath, "utf8"), path.basename(templateFolder)),
    picturePath,
    pictureWidth: pictureMetadata.width,
    pictureHeight: pictureMetadata.pageHeight ?? pictureMetadata.height,
  };
}
