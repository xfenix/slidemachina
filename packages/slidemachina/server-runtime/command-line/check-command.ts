import { readFileSync } from "node:fs";
import path from "node:path";
import { listPresentationFolders, presentationFileName, type SiteLayout } from "../presentation-repository/presentation-repository.ts";
import { checkPresentationSource } from "../presentation-checking/slide-rules.ts";
import { checkTexts, describeFinding } from "../presentation-checking/check-texts.ts";

type CheckFlags = { json?: boolean };

// A repository checks every talk in it. The exit code is 1 with remarks, so an agent or CI can stop on them.
// --json gives an agent the same remarks with the place in the file and the slide address for slidemachina shot.
export function runCheckCommand(siteLayout: SiteLayout, { json: printsJson }: CheckFlags): number {
  const presentationFolders = siteLayout.isRepository ? listPresentationFolders(siteLayout.rootFolder) : [siteLayout.rootFolder];
  const checkedPresentations = presentationFolders.map((presentationFolder) => {
    const presentationFile = path.join(presentationFolder, presentationFileName);
    const shownFile = path.relative(process.cwd(), presentationFile) || presentationFileName;
    return { shownFile, findings: checkPresentationSource(readFileSync(presentationFile, "utf8"), presentationFile) };
  });
  const findingTotal = checkedPresentations.reduce((runningTotal, { findings }) => runningTotal + findings.length, 0);
  if (printsJson) {
    const reportedFindings = checkedPresentations.flatMap(({ shownFile, findings }) =>
      findings.map((checkFinding) => ({
        file: shownFile,
        line: checkFinding.lineNumber,
        column: checkFinding.columnNumber,
        slide: checkFinding.slideAddress ?? null,
        rule: checkFinding.ruleName,
        found: checkFinding.foundCount,
        allowed: checkFinding.allowedCount,
        message: describeFinding(checkFinding),
      })),
    );
    console.log(JSON.stringify(reportedFindings, null, 2));
    return findingTotal > 0 ? 1 : 0;
  }
  for (const { shownFile, findings } of checkedPresentations) {
    if (findings.length === 0) console.log(checkTexts.noFindings(shownFile));
    for (const checkFinding of findings) {
      const slideLabel = checkFinding.slideAddress === undefined ? "" : `  ${checkTexts.slideLabel(checkFinding.slideAddress)}`;
      console.log(`${shownFile}:${checkFinding.lineNumber}:${checkFinding.columnNumber}${slideLabel}  ${describeFinding(checkFinding)}`);
    }
  }
  if (findingTotal > 0) console.log(`\n${checkTexts.findingCount(findingTotal)}`);
  return findingTotal > 0 ? 1 : 0;
}
