// Shared by the dev server in server-runtime/ and the page in browser-runtime/.
export const sourceEditEndpoint = "/@slidemachina/edit";
export const printedStepsStorageKey = "slidemachina-print-steps";
// A new key: the old one remembered "no hidden slides" for everyone, from the time that was the default.
export const printedHiddenStorageKey = "slidemachina-print-hidden-slides";
// "?print" opens all pages for printing in the browser, "?print=steps" a page per step, "&hidden=no" leaves out hidden slides.
export const printViewParameter = "print";
export const printViewStepsValue = "steps";
export const printViewHiddenParameter = "hidden";
export const printViewNoHiddenValue = "no";
export const memeSearchEndpoint = "/@slidemachina/meme-search";
// "?presentation=/talk&variant=pdf" builds the presentation of this dev server and answers with the file, ready to save.
export const presentationExportEndpoint = "/@slidemachina/export";
// The export button of the page polls it while the server builds the chosen file.
export const presentationExportStatusEndpoint = "/@slidemachina/export-status";
export type ExportedFileVariant = "html" | "pdf" | "pptx";
export type ExportStatusAnswer = { runningVariant: ExportedFileVariant | null; finished: { variant: ExportedFileVariant; succeeded: boolean; finishedAt: number } | null };
// Engine links carry it: a presentation with its own favicon removes them.
export const engineFaviconAttribute = "data-engine-favicon";
