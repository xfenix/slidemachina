import { Children, isValidElement, type ReactNode } from "react";
import { listMarkupElements } from "./markup-elements.ts";

export type NotesProperties = {
  children?: ReactNode;
  // The step this note belongs to: the presenter view marks it once the step is shown and dims it before.
  step?: number;
};
export type SlideNote = { noteStep: number; noteContent: ReactNode };

// Each of these starts a line in the plain text of the notes.
const blockTextElements = new Set(["p", "div", "ul", "ol", "blockquote", "pre", "h3", "h4"]);

// Speaker notes: nothing on the slide, its thumbnails and printed pages; the presenter view shows them, PowerPoint keeps them as slide notes.
export function Notes(_notesProperties: NotesProperties): ReactNode {
  return null;
}

// <Notes> stands right inside <Slide>; fragments are see-through.
export function listSlideNotes(slideChildren: ReactNode): SlideNote[] {
  return listMarkupElements(slideChildren)
    .filter((markupElement) => markupElement.type === Notes)
    .map((notesElement) => {
      const { children, step = 0 } = notesElement.props as NotesProperties;
      return { noteStep: step, noteContent: children };
    });
}

function collectNotesText(notesNode: ReactNode): string {
  return Children.toArray(notesNode)
    .map((childNode) => {
      if (typeof childNode === "string" || typeof childNode === "number") return String(childNode);
      if (!isValidElement(childNode)) return "";
      if (childNode.type === "br") return "\n";
      const nestedText = collectNotesText((childNode.props as { children?: ReactNode }).children);
      if (childNode.type === "li") return `\n• ${nestedText}\n`;
      return typeof childNode.type === "string" && blockTextElements.has(childNode.type) ? `\n${nestedText}\n` : nestedText;
    })
    .join("");
}

// Plain text for the notes of a PowerPoint slide: a paragraph or a list item per line.
export function writeNotesText(slideNotes: SlideNote[]): string {
  return slideNotes
    .map((slideNote) => collectNotesText(slideNote.noteContent))
    .join("\n")
    .replace(/[ \t]*\n\s*/g, "\n")
    .trim();
}
