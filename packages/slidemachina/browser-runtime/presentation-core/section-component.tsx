import type { ReactElement, ReactNode } from "react";

export type SectionProperties = {
  title: string;
  // false drops the cover slide; a <Slide> replaces the generated one and keeps the breadcrumbs of the section.
  cover?: boolean | ReactElement;
  children?: ReactNode;
};

export function Section(sectionProperties: SectionProperties): ReactNode {
  return sectionProperties.children;
}
