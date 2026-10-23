import type { ReactNode } from "react";

export type SectionProperties = {
  title: string;
  cover?: boolean;
  children?: ReactNode;
};

export function Section(sectionProperties: SectionProperties): ReactNode {
  return sectionProperties.children;
}
