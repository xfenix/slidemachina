import type { ReactNode } from "react";
import { pickSourceMarks } from "../../presentation-core/source-marks.ts";

export type QuoteProperties = {
  children?: ReactNode;
  author?: string;
};

// Quotation marks come from CSS by the page language: «…» for ru, “…” for en.
export function Quote({ children, author, ...otherProperties }: QuoteProperties) {
  return (
    <figure data-quote>
      <blockquote {...pickSourceMarks(otherProperties)}>{children}</blockquote>
      {author !== undefined && <figcaption>{author}</figcaption>}
    </figure>
  );
}
