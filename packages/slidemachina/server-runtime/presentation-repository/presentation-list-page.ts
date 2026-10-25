import path from "node:path";
import { defaultAspectRatio, measureCanvasSize, type CanvasSize } from "../../shared-between-runtimes/canvas-size.ts";
import { pickTextLanguage } from "../../shared-between-runtimes/text-language.ts";
import { commandLineLanguage } from "../command-line/command-line-texts.ts";
import { escapeHtml } from "../presentation-build/html-escaping.ts";
import { listPresentationFolders } from "./presentation-repository.ts";
import { readPresentationFile } from "../source-transforms/presentation-settings.ts";
import type { SiteLayout } from "./presentation-repository.ts";

export type PresentationCard = { folderName: string, presentationTitle: string, presentationDate: string | undefined, languageCode: string, canvasSize: CanvasSize };
type CardDownload = { variantName: "pdf" | "pdf-steps" | "zip", downloadAddress: string };
export type ListedCard = PresentationCard & { pageAddress: string, coverKind: "frame" | "picture" | "none", coverAddress: string, isProtected?: boolean, downloads?: CardDownload[] };
type ListTexts = (typeof listTextsByLanguage)["en"];

// Twice the width of a card on the list: sharp on retina screens, 6–8 KB in WebP.
export const coverWidth = 960;

// The transition opt-in sits in the page: in dev the stylesheets arrive after the browser has decided on the transition.
export const pageTransitionStyle = `<style>@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }</style>`;

const lockIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;

// The list speaks the language of the presentations, not of the terminal that built it.
const listTextsByLanguage = {
  en: {
    pageTitle: "Presentations",
    presentationCount: (presentationCount: number): string => `${presentationCount} ${presentationCount === 1 ? "presentation" : "presentations"}`,
    emptyList: "No presentations yet. Create one: npm create slidemachina",
    protectedBadge: "Password",
    downloadLabels: { pdf: "PDF", "pdf-steps": "PDF by steps", zip: "zip" },
  },
  ru: {
    pageTitle: "Презентации",
    presentationCount: (presentationCount: number): string => {
      const pluralForms: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "презентация", few: "презентации", many: "презентаций", other: "презентации" };
      return `${presentationCount} ${pluralForms[new Intl.PluralRules("ru").select(presentationCount)] ?? pluralForms.other}`;
    },
    emptyList: "Презентаций пока нет. Создайте первую: npm create slidemachina",
    protectedBadge: "Под паролем",
    downloadLabels: { pdf: "PDF", "pdf-steps": "PDF по шагам", zip: "zip" },
  },
};

function pickListLanguage(presentationCards: PresentationCard[]): "ru" | "en" {
  const languageCounts = new Map<"ru" | "en", number>();
  for (const presentationCard of presentationCards) {
    const languageCode = pickTextLanguage(presentationCard.languageCode);
    languageCounts.set(languageCode, (languageCounts.get(languageCode) ?? 0) + 1);
  }
  const [mostCommonLanguage] = [...languageCounts].sort((firstEntry, secondEntry) => secondEntry[1] - firstEntry[1])[0] ?? [commandLineLanguage];
  return mostCommonLanguage;
}

// "31 июля 2026" without the trailing "г.", "July 31, 2026" in English.
function formatPresentationDate(isoDateText: string, languageCode: string): string {
  const parsedDate = new Date(`${isoDateText}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return isoDateText;
  return new Intl.DateTimeFormat(languageCode, { dateStyle: "long" }).format(parsedDate).replace(/\s*г\.$/, "");
}

// Newest first by <Presentation date>; presentations without a date go last, by title.
function comparePresentationCards(firstCard: PresentationCard, secondCard: PresentationCard): number {
  if (firstCard.presentationDate !== secondCard.presentationDate) {
    if (firstCard.presentationDate === undefined) return 1;
    if (secondCard.presentationDate === undefined) return -1;
    return secondCard.presentationDate.localeCompare(firstCard.presentationDate);
  }
  return firstCard.presentationTitle.localeCompare(secondCard.presentationTitle);
}

// A presentation with a syntax error still gets its card: the list stays usable while the file is being fixed.
export function readPresentationCards(repositoryFolder: string): PresentationCard[] {
  return listPresentationFolders(repositoryFolder)
    .map((presentationFolder) => {
      const folderName = path.basename(presentationFolder);
      const presentationSettings: { languageCode: string, presentationTitle?: string, presentationDate?: string, aspectRatio?: string } = (() => {
        try {
          return readPresentationFile(presentationFolder);
        } catch {
          return { languageCode: "en" };
        }
      })();
      return {
        folderName,
        presentationTitle: presentationSettings.presentationTitle ?? folderName,
        presentationDate: presentationSettings.presentationDate,
        languageCode: presentationSettings.languageCode,
        // A wrong format fails the build of the presentation itself; its card meanwhile keeps the default one.
        canvasSize: measureCanvasSize(presentationSettings.aspectRatio ?? defaultAspectRatio) ?? measureCanvasSize(defaultAspectRatio)!,
      };
    })
    .sort(comparePresentationCards);
}

function renderCover(presentationCard: ListedCard, listTexts: ListTexts): string {
  const { coverKind, coverAddress } = presentationCard;
  const protectedBadge = presentationCard.isProtected ? `<span data-list-badge>${lockIcon}${escapeHtml(listTexts.protectedBadge)}</span>` : "";
  const coverTitle = `<span data-list-cover-title>${escapeHtml(presentationCard.presentationTitle)}</span>${protectedBadge}`;
  if (coverKind === "frame") {
    return `${coverTitle}<iframe src="${escapeHtml(coverAddress)}" loading="lazy" tabindex="-1" aria-hidden="true" title=""></iframe>`;
  }
  if (coverKind === "picture") {
    const coverHeight = Math.round((coverWidth * presentationCard.canvasSize.canvasHeight) / presentationCard.canvasSize.canvasWidth);
    return `${coverTitle}<img src="${escapeHtml(coverAddress)}" alt="" width="${coverWidth}" height="${coverHeight}" loading="lazy" decoding="async" />`;
  }
  return coverTitle;
}

function renderCard(presentationCard: ListedCard, listTexts: ListTexts, languageCode: string): string {
  const { presentationDate, downloads = [], canvasSize: { canvasWidth, canvasHeight } } = presentationCard;
  const shownDate = presentationDate === undefined
    ? ""
    : `<time datetime="${escapeHtml(presentationDate)}">${escapeHtml(formatPresentationDate(presentationDate, languageCode))}</time>`;
  const downloadLinks = downloads.map(
    ({ variantName, downloadAddress }) => `<a href="${escapeHtml(downloadAddress)}" download>${escapeHtml(listTexts.downloadLabels[variantName])}</a>`,
  );
  return `
        <li data-list-card>
          <a data-list-link href="${escapeHtml(presentationCard.pageAddress)}">
            <span data-list-cover style="aspect-ratio: ${canvasWidth} / ${canvasHeight}">${renderCover(presentationCard, listTexts)}</span>
            <span data-list-title>${escapeHtml(presentationCard.presentationTitle)}</span>
            <span data-list-meta>${shownDate}<span data-list-folder>${escapeHtml(presentationCard.folderName)}</span></span>
          </a>${downloadLinks.length === 0 ? "" : `\n          <span data-list-downloads>${downloadLinks.join("")}</span>`}
        </li>`;
}

// Every card says where the presentation opens, what its cover is and which files can be downloaded.
export function renderListPage(presentationCards: ListedCard[], listModuleId: string, headAddition = ""): string {
  const languageCode = pickListLanguage(presentationCards);
  const listTexts = listTextsByLanguage[languageCode];
  const listBody = presentationCards.length === 0
    ? `<p data-list-empty>${escapeHtml(listTexts.emptyList)}</p>`
    : `<ul data-list-grid>${presentationCards.map((presentationCard) => renderCard(presentationCard, listTexts, languageCode)).join("")}
      </ul>`;
  return `<!doctype html>
<html lang="${languageCode}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="data:," />
    <title>${escapeHtml(listTexts.pageTitle)}</title>
    ${pageTransitionStyle}${headAddition}
    <script type="module" src="${listModuleId}"></script>
  </head>
  <body>
    <main data-presentation-list>
      <header data-list-header>
        <h1>${escapeHtml(listTexts.pageTitle)}</h1>
        <p>${escapeHtml(listTexts.presentationCount(presentationCards.length))}</p>
      </header>
      ${listBody}
    </main>
  </body>
</html>`;
}

// In slidemachina dev every cover is the live first slide in a frame: theme edits reach it at once.
export function createDevelopmentListPage(siteLayout: SiteLayout, listModuleId: string): string {
  const presentationCards: ListedCard[] = readPresentationCards(siteLayout.rootFolder).map((presentationCard) => {
    const sitePath = `/${encodeURIComponent(presentationCard.folderName)}/`;
    return { ...presentationCard, pageAddress: sitePath, coverKind: "frame", coverAddress: `${sitePath}?cover` };
  });
  // Styles come with the module here, a moment after the page: it stays hidden until presentation-list.css shows it.
  return renderListPage(presentationCards, listModuleId, "\n    <style>body { visibility: hidden; }</style>");
}
