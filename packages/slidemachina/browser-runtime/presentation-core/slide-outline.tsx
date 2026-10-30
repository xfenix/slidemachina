import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { findOpeningCover, outlineSlideMarkup, type SectionPlace, type SlideOutlineReader } from "../../shared-between-runtimes/slide-outline-rules.js";
import { listMarkupElements } from "./markup-elements.ts";
import { pickSourceMarks } from "./source-marks.ts";
import { Section, type SectionProperties } from "./section-component.tsx";
import { SectionNumber } from "./section-number.tsx";
import { Slide, type SlideProperties } from "./slide-component.tsx";
import { listSlideNotes, type SlideNote } from "./slide-notes.tsx";

export type OutlinedSlide = {
  slideKey: string;
  slideElement: ReactElement;
  sectionTrail: string[];
  slideNotes: SlideNote[];
  isHidden: boolean;
};

const elementOutlineReader: SlideOutlineReader<ReactElement> = {
  classifyMarkupNode: (markupElement) =>
    markupElement.type === Fragment ? "fragment" : markupElement.type === Section ? "section" : "slide",
  listMarkupChildren: (markupElement) =>
    Children.toArray((markupElement.props as { children?: ReactNode }).children).filter(isValidElement),
  dropsSectionCover: (sectionElement) => (sectionElement.props as SectionProperties).cover === false,
  isCoverSlide: (slideElement) => slideElement.type === Slide && (slideElement.props as SlideProperties).cover === true,
};

// Text inside nested tags counts too; a line break stays a space.
function collectElementText(markupChildren: ReactNode): string {
  return Children.toArray(markupChildren)
    .map((childNode) => {
      if (typeof childNode === "string" || typeof childNode === "number") return String(childNode);
      if (!isValidElement(childNode)) return "";
      return childNode.type === "br" ? " " : collectElementText((childNode.props as { children?: ReactNode }).children);
    })
    .join("");
}

function findHeadingText(markupChildren: ReactNode): string | undefined {
  for (const markupElement of listMarkupElements(markupChildren)) {
    const elementChildren = (markupElement.props as { children?: ReactNode }).children;
    if (markupElement.type === "h1") return collectElementText(elementChildren).replace(/ {2,}/g, " ").trim();
    if (typeof markupElement.type !== "string") continue;
    const nestedHeadingText = findHeadingText(elementChildren);
    if (nestedHeadingText !== undefined) return nestedHeadingText;
  }
  return undefined;
}

function readCoverTitle(coverElement: ReactElement | undefined): string | undefined {
  return coverElement === undefined ? undefined : findHeadingText((coverElement.props as SlideProperties).children);
}

function nameSection({ sectionNode, ownCover }: SectionPlace<ReactElement>): string {
  return (sectionNode.props as SectionProperties).title ?? readCoverTitle(ownCover) ?? "";
}

// The h1 of the opening <Slide cover> names the talk when <Presentation> has no title.
export function readPresentationTitle(presentationChildren: ReactNode): string | undefined {
  const presentationElements = Children.toArray(presentationChildren).filter(isValidElement);
  return readCoverTitle(findOpeningCover(presentationElements, elementOutlineReader));
}

export function buildSlideOutline(presentationChildren: ReactNode): OutlinedSlide[] {
  const presentationElements = Children.toArray(presentationChildren).filter(isValidElement);
  return outlineSlideMarkup(presentationElements, elementOutlineReader).map((outlinedMarkup): OutlinedSlide => {
    const enclosingKey = outlinedMarkup.enclosingNodes.map((enclosingElement) => `/${enclosingElement.key}`).join("");
    const sectionTitles = outlinedMarkup.sectionPlaces.map(nameSection);
    const sectionTrail = sectionTitles.filter((sectionTitle) => sectionTitle !== "");
    if (!outlinedMarkup.isGeneratedCover) {
      const slideProperties = outlinedMarkup.slideNode.props as SlideProperties;
      const slideNotes = listSlideNotes(slideProperties.children);
      const isHidden = slideProperties.hidden === true;
      return { slideKey: `${enclosingKey}/${outlinedMarkup.slideNode.key}`, slideElement: outlinedMarkup.slideNode, sectionTrail, slideNotes, isHidden };
    }
    const { sectionNumber } = outlinedMarkup.sectionPlaces.at(-1)!;
    // The title of the section is edited on its cover: the marks of the <Section> tag name the attribute to rewrite.
    const sectionCover = (
      <Slide cover background="var(--section-background)">
        <h1 data-section-number={sectionNumber} {...pickSourceMarks(outlinedMarkup.sectionPlaces.at(-1)!.sectionNode.props as object)}>
          {sectionTitles.at(-1)}
        </h1>
        <SectionNumber sectionNumber={sectionNumber} sectionTitle={sectionTitles.at(-1)} />
      </Slide>
    );
    return { slideKey: `${enclosingKey}/cover`, slideElement: sectionCover, sectionTrail, slideNotes: [], isHidden: false };
  });
}
