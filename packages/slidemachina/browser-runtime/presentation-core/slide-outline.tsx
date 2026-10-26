import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { outlineSlideMarkup, type SlideOutlineReader } from "../../shared-between-runtimes/slide-outline-rules.js";
import { Section, type SectionProperties } from "./section-component.tsx";
import { SectionNumber } from "./section-number.tsx";
import { Slide } from "./slide-component.tsx";

export type OutlinedSlide = {
  slideKey: string;
  slideElement: ReactElement;
  sectionTrail: string[];
};

const elementOutlineReader: SlideOutlineReader<ReactElement> = {
  classifyMarkupNode: (markupElement) =>
    markupElement.type === Fragment ? "fragment" : markupElement.type === Section ? "section" : "slide",
  listMarkupChildren: (markupElement) =>
    Children.toArray((markupElement.props as { children?: ReactNode }).children).filter(isValidElement),
  readSectionCover: (sectionElement) => {
    const sectionCover = (sectionElement.props as SectionProperties).cover;
    return isValidElement(sectionCover) ? sectionCover : sectionCover !== false;
  },
};

export function buildSlideOutline(presentationChildren: ReactNode): OutlinedSlide[] {
  const presentationElements = Children.toArray(presentationChildren).filter(isValidElement);
  return outlineSlideMarkup(presentationElements, elementOutlineReader).map((outlinedMarkup): OutlinedSlide => {
    const enclosingKey = outlinedMarkup.enclosingNodes.map((enclosingElement) => `/${enclosingElement.key}`).join("");
    const sectionTrail = outlinedMarkup.sectionPlaces.map((sectionPlace) => (sectionPlace.sectionNode.props as SectionProperties).title);
    if (!outlinedMarkup.isSectionCover) {
      return { slideKey: `${enclosingKey}/${outlinedMarkup.slideNode.key}`, slideElement: outlinedMarkup.slideNode, sectionTrail };
    }
    const { sectionNode, sectionNumber } = outlinedMarkup.sectionPlaces.at(-1)!;
    const sectionCover =
      outlinedMarkup.slideNode !== sectionNode ? (
        outlinedMarkup.slideNode
      ) : (
        <Slide cover background="var(--section-background)">
          <h1 data-section-number={sectionNumber}>{sectionTrail.at(-1)}</h1>
          <SectionNumber sectionNumber={sectionNumber} />
        </Slide>
      );
    return { slideKey: `${enclosingKey}/cover`, slideElement: sectionCover, sectionTrail };
  });
}
