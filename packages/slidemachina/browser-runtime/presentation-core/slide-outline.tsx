import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { Section, type SectionProperties } from "./section-component.tsx";
import { SectionNumber } from "./section-number.tsx";
import { Slide } from "./slide-component.tsx";

export type OutlinedSlide = {
  slideKey: string;
  slideElement: ReactElement;
  sectionTrail: string[];
};

export function buildSlideOutline(
  presentationChildren: ReactNode,
  sectionTrail: string[] = [],
  parentKey = "",
  parentSectionNumber = "",
): OutlinedSlide[] {
  let sectionCount = 0;
  return Children.toArray(presentationChildren)
    .filter(isValidElement)
    .flatMap((childElement): OutlinedSlide[] => {
      const childKey = `${parentKey}/${childElement.key}`;
      if (childElement.type === Fragment) {
        const fragmentProperties = childElement.props as { children?: ReactNode };
        return buildSlideOutline(fragmentProperties.children, sectionTrail, childKey, parentSectionNumber);
      }
      if (childElement.type !== Section) {
        return [{ slideKey: childKey, slideElement: childElement, sectionTrail }];
      }
      const sectionProperties = childElement.props as SectionProperties;
      const nestedTrail = [...sectionTrail, sectionProperties.title];
      sectionCount += 1;
      // "02" for the second section, "02.1" for the first section inside it.
      const sectionNumber =
        parentSectionNumber === "" ? String(sectionCount).padStart(2, "0") : `${parentSectionNumber}.${sectionCount}`;
      const sectionSlides = buildSlideOutline(sectionProperties.children, nestedTrail, childKey, sectionNumber);
      if (sectionProperties.cover === false) return sectionSlides;
      const sectionCover = isValidElement(sectionProperties.cover) ? (
        sectionProperties.cover
      ) : (
        <Slide cover background="var(--section-background)">
          <h1 data-section-number={sectionNumber}>{sectionProperties.title}</h1>
          <SectionNumber sectionNumber={sectionNumber} />
        </Slide>
      );
      return [{ slideKey: `${childKey}/cover`, slideElement: sectionCover, sectionTrail: nestedTrail }, ...sectionSlides];
    });
}
