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
// Engine links carry it: a presentation with its own favicon removes them.
export const engineFaviconAttribute = "data-engine-favicon";
