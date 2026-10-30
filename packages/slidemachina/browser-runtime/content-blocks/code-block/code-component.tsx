import { useMemo, useRef, type CSSProperties } from "react";
import { parseLineSteps, useCodeLineSteps } from "./code-line-steps.ts";
import { createStepAttributes } from "../../slide-steps/step-attributes.ts";
import { pickSourceMarks } from "../../presentation-core/source-marks.ts";
import { useWidthFitting, type WidthFitting } from "../../presentation-core/width-fitting.ts";

// Long lines get a smaller font down to 20 px, then wrap: code never sticks out of its block.
// The box hangs out to the left with a negative margin, so that margin is room too; a column moved over by the hang has it as padding.
const codeWidthFitting: WidthFitting = {
  findTextElement: (codeElement) => codeElement.querySelector("code"),
  measureRoom: (codeElement) => {
    const roomElement = codeElement.parentElement;
    if (roomElement === null) return 0;
    const codeStyle = getComputedStyle(codeElement);
    const roomStyle = getComputedStyle(roomElement);
    const takenWidths = [roomStyle.paddingLeft, roomStyle.paddingRight, codeStyle.marginLeft, codeStyle.paddingLeft, codeStyle.paddingRight];
    return takenWidths.reduce((remainingWidth, takenWidth) => remainingWidth - Number.parseFloat(takenWidth), roomElement.clientWidth);
  },
  smallestFontSize: 20,
};

// [text, colour on light slides, colour on dark slides]; whitespace is a plain string.
type CodeFragment = string | [string, string | undefined, string | undefined];
type HighlightedCode = {
  // number is the line in the source: a line with only a [!code …] comment is gone from the list.
  lines: Array<{ tokens: CodeFragment[]; marked: boolean; number?: number }>;
};
export type CodeProperties = {
  children?: string;
  lang?: string;
  src?: string;
  lines?: string;
  numbers?: boolean;
  title?: string;
  // Filled in by the build from Shiki; written by hand only without the slidemachina CLI.
  highlightedCode?: HighlightedCode;
};

function listPlainLines(codeText: string): HighlightedCode {
  return { lines: codeText.split("\n").map((lineText) => ({ tokens: [lineText], marked: false })) };
}

function renderCodeFragment(codeFragment: CodeFragment, fragmentIndex: number) {
  if (typeof codeFragment === "string") return codeFragment;
  const [tokenText, lightColor, darkColor] = codeFragment;
  const tokenStyle = { "--token-light": lightColor, "--token-dark": darkColor } as CSSProperties;
  return (
    <span key={fragmentIndex} data-code-token style={tokenStyle}>
      {tokenText}
    </span>
  );
}

export function Code({ children, lang, src, lines, numbers, title, highlightedCode, ...otherProperties }: CodeProperties) {
  const codeElementReference = useRef<HTMLPreElement>(null);
  const shownCode = highlightedCode ?? listPlainLines(children ?? "");
  const codeLineCount = shownCode.lines.length;
  const lastLineNumber = shownCode.lines.at(-1)?.number ?? codeLineCount;
  const lineSteps = useMemo(() => parseLineSteps(lines, lastLineNumber), [lines, lastLineNumber]);
  useCodeLineSteps(codeElementReference, lineSteps);
  useWidthFitting(codeElementReference, codeWidthFitting, shownCode);
  const shownTitle = title ?? src?.split("/").at(-1);
  const isOneLine = codeLineCount === 1 && shownTitle === undefined && numbers !== true;
  const numberStyle = numbers === true ? ({ "--code-number-digits": String(lastLineNumber).length } as CSSProperties) : undefined;

  return (
    <pre
      ref={codeElementReference}
      data-code
      data-lang={lang}
      data-one-line={isOneLine ? "" : undefined}
      data-numbered={numbers === true ? "" : undefined}
      style={numberStyle}
    >
      {shownTitle !== undefined && <span data-code-title {...pickSourceMarks(otherProperties)}>{shownTitle}</span>}
      <div data-code-viewport>
        <code>
          {shownCode.lines.map((codeLine, lineIndex) => (
            <span key={lineIndex} data-code-line={codeLine.number ?? lineIndex + 1} data-marked={codeLine.marked || undefined}>
              {codeLine.tokens.map(renderCodeFragment)}
            </span>
          ))}
        </code>
      </div>
      {[...lineSteps.keys()].slice(1).map((stepPosition) => (
        <span key={stepPosition} data-code-step hidden {...createStepAttributes(true, "fade")} />
      ))}
    </pre>
  );
}
