import { strFromU8, strToU8 } from "fflate";

const notesSlidePath = /^ppt\/notesSlides\/notesSlide\d+\.xml$/;
const textRunStart = '<a:r><a:rPr lang="en-US" dirty="0"/><a:t>';

// pptxgenjs writes slide notes as one run: every line of the notes becomes a paragraph of its own.
export function splitNotesParagraphs(pptxFiles: Record<string, Uint8Array>): void {
  for (const [filePath, fileBytes] of Object.entries(pptxFiles)) {
    if (!notesSlidePath.test(filePath)) continue;
    const notesXml = strFromU8(fileBytes);
    const splitXml = notesXml.replace(/<a:t>([^<]*\n[^<]*)<\/a:t>/g, (_runMatch, notesText: string) =>
      `<a:t>${notesText.split("\n").join(`</a:t></a:r></a:p><a:p>${textRunStart}`)}</a:t>`,
    );
    if (splitXml !== notesXml) pptxFiles[filePath] = strToU8(splitXml);
  }
}
