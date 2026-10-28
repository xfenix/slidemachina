import type { ReactNode } from "react";

export type SectionProperties = {
  // Without a title the h1 of the section's own opening <Slide cover> names it.
  title?: string;
  // false drops the generated cover slide; a section that opens with its own <Slide cover> has none anyway.
  cover?: boolean;
  children?: ReactNode;
};

export function Section(sectionProperties: SectionProperties): ReactNode {
  return sectionProperties.children;
}
