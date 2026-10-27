// Attributes the export writes on the printed slides. The page script gets the same object under the same name.
export const pptxPageMarks = {
  textWrapper: "data-pptx-text",
  convertedFill: "data-pptx-fill",
  convertedBorder: "data-pptx-border",
  wholeElement: "data-pptx-whole",
  stepOwner: "data-pptx-owner",
  captureMark: "data-pptx-capture",
  captureSubject: "data-pptx-subject",
  capturePath: "data-pptx-path",
  capturing: "data-pptx-capturing",
  slideBackdrop: "data-pptx-backdrop",
};
// Values the page functions need; they get this object under the same name too.
export const pageReadingConstants = {
  fullChannel: 255,
  hexadecimalBase: 16,
  rotationTolerance: 0.001,
  collapsedSpaceWidth: 0.5,
  millisecondsPerSecond: 1000,
  maximalVectorPaths: 16,
  layoutTolerance: 0.5,
  boldFontWeight: 600,
  largestSingleUnitCode: 0xffff,
  appearanceEffects: ["rise", "fade", "scale"],
  defaultStepDuration: 300,
  gapSpaceShare: 1.5,
  percentScale: 100,
  // Bullets, numbers and code boxes hang outside their element: the picture of a subject takes a margin around it.
  subjectFrameMargin: 96,
  pathParameterCounts: { m: 2, l: 2, h: 1, v: 1, q: 4, c: 6, z: 0 } as Record<string, number>,
};

// The export page is never shown: its backdrop is transparent and nothing moves. While a picture is taken,
// everything a native object already shows turns invisible, and so does everything outside the subject.
// Only the page being taken gets the capturing mark, so the other pages keep their styles.
export function writeCaptureStylesheet(): string {
  const { textWrapper, convertedFill, convertedBorder, wholeElement, stepOwner, captureSubject, capturePath, capturing, slideBackdrop } = pptxPageMarks;
  const takenPage = `[data-print-page][${capturing}]`;
  return `
    html, body, [data-presentation], [data-print-pages], [data-print-page] {
      background: transparent !important;
      box-shadow: none !important;
      outline: none !important;
    }
    *, *::before, *::after { transition: none !important; }
    [data-print-view-bar] { visibility: hidden !important; }
    ${takenPage} [${textWrapper}] {
      color: transparent !important;
      -webkit-text-fill-color: transparent !important;
      -webkit-text-stroke-color: transparent !important;
      text-decoration-color: transparent !important;
      text-shadow: none !important;
    }
    ${takenPage} [${convertedFill}] { background-color: transparent !important; }
    ${takenPage} [${convertedBorder}] { border-color: transparent !important; }
    ${takenPage} [${wholeElement}]:not([${captureSubject}]),
    ${takenPage} [${stepOwner}]:not([${captureSubject}], [${capturePath}]),
    ${takenPage}[${capturePath}] > :not([${capturePath}], [${captureSubject}]),
    ${takenPage} [${capturePath}] > :not([${capturePath}], [${captureSubject}]) {
      opacity: 0 !important;
    }
    ${takenPage} [${capturePath}] {
      background: none !important;
      border-color: transparent !important;
      box-shadow: none !important;
      outline-color: transparent !important;
    }
    ${takenPage} [${slideBackdrop}][${captureSubject}] > * { opacity: 0 !important; }
    ${takenPage}[${captureSubject}] [${slideBackdrop}] { background: none !important; box-shadow: none !important; }
    ${takenPage}[${captureSubject}] [${slideBackdrop}]::before, ${takenPage}[${captureSubject}] [${slideBackdrop}]::after,
    ${takenPage} [${capturePath}]::before, ${takenPage} [${capturePath}]::after {
      visibility: hidden !important;
    }
  `;
}
