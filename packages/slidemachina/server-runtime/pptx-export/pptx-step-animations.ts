import { strFromU8, strToU8 } from "fflate";
import { videoNamePrefix } from "./pptx-slide-drawing.ts";
import type { AnimatedObject, SlideAnimation } from "./pptx-slide-drawing.ts";
import type { AppearanceEffect } from "./slide-part-types.ts";

// pptxgenjs has no animations: the timing tree goes into each slide's XML after it is written.
type EffectPreset = { presetIdentifier: number; presetSubtype: number };

const effectPresets: Record<AppearanceEffect, EffectPreset> = {
  fade: { presetIdentifier: 10, presetSubtype: 0 },
  rise: { presetIdentifier: 42, presetSubtype: 0 },
  scale: { presetIdentifier: 53, presetSubtype: 16 },
};
// The web rise moves text up by about 0.6 em of body text: 24 px of the 1080 px slide height.
const riseDistanceShare = 0.022;
const startingScaleShare = 0.9;
const fullTimeline = 100000;
// Time nodes 1 and 2 are the root and the main sequence.
const reservedTimeNodes = 2;

function writeTarget(shapeIdentifier: string): string {
  return `<p:tgtEl><p:spTgt spid="${shapeIdentifier}"/></p:tgtEl>`;
}

function writeMotion(timeIdentifier: number, shapeIdentifier: string, stepDuration: number, attributeName: string, startingValue: string): string {
  return (
    `<p:anim calcmode="lin" valueType="num"><p:cBhvr><p:cTn id="${timeIdentifier}" dur="${stepDuration}" fill="hold"/>${writeTarget(shapeIdentifier)}` +
    `<p:attrNameLst><p:attrName>${attributeName}</p:attrName></p:attrNameLst></p:cBhvr>` +
    `<p:tavLst><p:tav tm="0"><p:val><p:strVal val="${startingValue}"/></p:val></p:tav>` +
    `<p:tav tm="${fullTimeline}"><p:val><p:strVal val="#${attributeName}"/></p:val></p:tav></p:tavLst></p:anim>`
  );
}

// Every object of a step appears on the same click: the first starts it, the rest go with it.
function writeEntrance(nextIdentifier: () => number, shapeIdentifier: string, stepEffect: AppearanceEffect, stepDuration: number, isFirst: boolean): string {
  const { presetIdentifier, presetSubtype } = effectPresets[stepEffect];
  const effectIdentifier = nextIdentifier();
  const behaviours = [
    `<p:set><p:cBhvr><p:cTn id="${nextIdentifier()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${writeTarget(shapeIdentifier)}` +
      `<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`,
    `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${nextIdentifier()}" dur="${stepDuration}"/>${writeTarget(shapeIdentifier)}</p:cBhvr></p:animEffect>`,
  ];
  if (stepEffect === "rise") behaviours.push(writeMotion(nextIdentifier(), shapeIdentifier, stepDuration, "ppt_y", `#ppt_y+${riseDistanceShare}`));
  if (stepEffect === "scale") {
    behaviours.push(writeMotion(nextIdentifier(), shapeIdentifier, stepDuration, "ppt_w", `#ppt_w*${startingScaleShare}`));
    behaviours.push(writeMotion(nextIdentifier(), shapeIdentifier, stepDuration, "ppt_h", `#ppt_h*${startingScaleShare}`));
  }
  return (
    `<p:par><p:cTn id="${effectIdentifier}" presetID="${presetIdentifier}" presetClass="entr" presetSubtype="${presetSubtype}" fill="hold" grpId="0" ` +
    `nodeType="${isFirst ? "clickEffect" : "withEffect"}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${behaviours.join("")}</p:childTnLst></p:cTn></p:par>`
  );
}

function writeTiming(animatedObjects: AnimatedObject[], objectIdentifiers: Map<string, string>, stepDuration: number): string | undefined {
  const placedObjects = animatedObjects.filter((animatedObject) => objectIdentifiers.has(animatedObject.objectName));
  const stepNumbers = [...new Set(placedObjects.map((animatedObject) => animatedObject.stepNumber))].toSorted((firstStep, secondStep) => firstStep - secondStep);
  if (stepNumbers.length === 0) return undefined;
  let lastIdentifier = reservedTimeNodes;
  const nextIdentifier = () => {
    lastIdentifier += 1;
    return lastIdentifier;
  };
  const clickGroups = stepNumbers.map((stepNumber) => {
    const [clickIdentifier, groupIdentifier] = [nextIdentifier(), nextIdentifier()];
    const entrances = placedObjects
      .filter((animatedObject) => animatedObject.stepNumber === stepNumber)
      .map((animatedObject, objectPosition) =>
        writeEntrance(nextIdentifier, objectIdentifiers.get(animatedObject.objectName)!, animatedObject.stepEffect, stepDuration, objectPosition === 0),
      );
    return (
      `<p:par><p:cTn id="${clickIdentifier}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>` +
      `<p:par><p:cTn id="${groupIdentifier}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${entrances.join("")}</p:childTnLst></p:cTn></p:par>` +
      `</p:childTnLst></p:cTn></p:par>`
    );
  });
  const buildList = placedObjects
    .filter((animatedObject) => animatedObject.isNativeShape)
    .map((animatedObject) => `<p:bldP spid="${objectIdentifiers.get(animatedObject.objectName)}" grpId="0" animBg="1"/>`)
    .join("");
  return (
    `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${clickGroups.join("")}</p:childTnLst></p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>` +
    `</p:childTnLst></p:cTn></p:par></p:tnLst>${buildList === "" ? "" : `<p:bldLst>${buildList}</p:bldLst>`}</p:timing>`
  );
}

// pptxgenjs numbers a video by its relationship and other objects by position, so a video may share a number with a shape.
// The video keeps its number, PowerPoint ties it to the cover; a shape that collides gets a free one.
function separateObjectNumbers(slideXml: string): string {
  const objectMatches = [...slideXml.matchAll(/<p:cNvPr id="(\d+)" name="([^"]*)"/g)];
  const usedNumbers = new Set(objectMatches.filter(([, , objectName]) => objectName!.startsWith(videoNamePrefix)).map(([, objectNumber]) => Number(objectNumber)));
  let freeNumber = Math.max(0, ...objectMatches.map(([, objectNumber]) => Number(objectNumber)));
  return slideXml.replaceAll(/<p:cNvPr id="(\d+)" name="([^"]*)"/g, (matchedText, objectNumber: string, objectName: string) => {
    if (objectName.startsWith(videoNamePrefix)) return matchedText;
    if (!usedNumbers.has(Number(objectNumber))) {
      usedNumbers.add(Number(objectNumber));
      return matchedText;
    }
    freeNumber += 1;
    usedNumbers.add(freeNumber);
    return `<p:cNvPr id="${freeNumber}" name="${objectName}"`;
  });
}

// Works on the unpacked files of the written presentation, so the export unpacks and packs it once.
export function writeStepAnimations(pptxFiles: Record<string, Uint8Array>, slideAnimations: SlideAnimation[]): void {
  slideAnimations.forEach(({ animatedObjects, stepDuration }, slideIndex) => {
    const slidePath = `ppt/slides/slide${slideIndex + 1}.xml`;
    const slideBytes = pptxFiles[slidePath];
    if (slideBytes === undefined) return;
    const slideXml = separateObjectNumbers(strFromU8(slideBytes));
    pptxFiles[slidePath] = strToU8(slideXml);
    if (animatedObjects.length === 0) return;
    const objectIdentifiers = new Map([...slideXml.matchAll(/<p:cNvPr id="(\d+)" name="([^"]*)"/g)].map(([, shapeIdentifier, objectName]) => [objectName!, shapeIdentifier!]));
    const timingXml = writeTiming(animatedObjects, objectIdentifiers, Math.round(stepDuration));
    if (timingXml !== undefined) pptxFiles[slidePath] = strToU8(slideXml.replace("</p:sld>", `${timingXml}</p:sld>`));
  });
}
