import { useMemo, useRef, type CSSProperties } from "react";
import { parseLineSteps, useCodeLineSteps } from "./code-line-steps.ts";
import { createStepAttributes } from "../../slide-steps/step-attributes.ts";
import { useWidthFitting, type WidthFitting } from "../../presentation-core/width-fitting.ts";

// Long lines get a smaller font down to 20 px, then wrap: code never sticks out of its block.
const codeWidthFitting: WidthFitting = {
  findTextElement: (codeElement) => codeElement.querySelector("code"),
  measureRoom: (codeElement) => {
    const codeStyle = getComputedStyle(codeElement);
    const horizontalPadding = Number.parseFloat(codeStyle.paddingLeft) + Number.parseFloat(codeStyle.paddingRight);
    return (codeElement.parentElement?.clientWidth ?? 0) - horizontalPadding;
  },
  smallestFontSize: 20,
};

// [text, colour on light slides, colour on dark slides]; whitespace is a plain string.
type CodeFragment = string | [string, string | undefined, string | undefined];
type HighlightedCode = {
  lines: Array<{ tokens: CodeFragment[]; marked: boolean }>;
};
export type CodeProperties = {
  children?: string;
  lang?: string;
  src?: string;
  lines?: string;
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

export function Code({ children, lang, src, lines, title, highlightedCode }: CodeProperties) {
  const codeElementReference = useRef<HTMLPreElement>(null);
  const shownCode = highlightedCode ?? listPlainLines(children ?? "");
  const codeLineCount = shownCode.lines.length;
  const lineSteps = useMemo(() => parseLineSteps(lines, codeLineCount), [lines, codeLineCount]);
  useCodeLineSteps(codeElementReference, lineSteps);
  useWidthFitting(codeElementReference, codeWidthFitting, shownCode);
  const shownTitle = title ?? src?.split("/").at(-1);

  return (
    <pre ref={codeElementReference} data-code data-lang={lang} data-one-line={codeLineCount === 1 && shownTitle === undefined ? "" : undefined}>
      {shownTitle !== undefined && <span data-code-title>{shownTitle}</span>}
      <div data-code-viewport>
        <code>
          {shownCode.lines.map((codeLine, lineIndex) => (
            <span key={lineIndex} data-code-line data-marked={codeLine.marked || undefined}>
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
