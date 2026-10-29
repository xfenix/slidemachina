import { pickTextLanguage } from "../../shared-between-runtimes/text-language.ts";
import type { CheckFinding, CheckRuleName } from "./slide-rules.ts";

type RuleText = (foundCount: number, allowedCount: number) => string;

const englishTexts = {
  ruleTexts: {
    longList: (foundCount, allowedCount) => `A list of ${foundCount} items: more than ${allowedCount} do not fit in the head. Split it into slides or keep 3–5 items`,
    wordySlide: (foundCount, allowedCount) => `${foundCount} words on the slide, more than ${allowedCount}. Say the rest aloud: move it to <Notes>`,
    crowdedDiagram: (foundCount, allowedCount) => `${foundCount} blocks in one diagram, more than ${allowedCount}. Group them, show them by steps or add <Focus>`,
    longCode: (foundCount, allowedCount) => `${foundCount} lines of code at once, more than ${allowedCount}. Show them by steps: lines="1-4 | 5-9"`,
    manyColumns: (foundCount, allowedCount) => `${foundCount} columns, more than ${allowedCount}. Keep three or move the rest to the next slide`,
    manySections: (foundCount, allowedCount) => `${foundCount} sections, more than ${allowedCount}. Join close ones: a talk is easier to follow in a few parts`,
    missingHeading: () => `The slide has no heading. Add <h2> with the thought of the slide, or make it a thesis, a quote or a meme`,
    missingAlt: () => `The picture has no alt. Describe it in a few words; alt="" if it is only decoration`,
  } satisfies Record<CheckRuleName, RuleText>,
  slideLabel: (slideAddress: string) => `slide ${slideAddress}`,
  noFindings: (presentationName: string) => `${presentationName}: every slide follows the rules`,
  findingCount: (findingCount: number) => `${findingCount} ${findingCount === 1 ? "remark" : "remarks"}. The rules: llms.txt in the slidemachina package`,
};

const russianTexts: typeof englishTexts = {
  ruleTexts: {
    longList: (foundCount, allowedCount) => `Список из ${foundCount} пунктов: больше ${allowedCount} не удержать в голове. Разбейте его на слайды или оставьте 3–5 пунктов`,
    wordySlide: (foundCount, allowedCount) => `На слайде ${foundCount} слов, больше ${allowedCount}. Остальное скажите вслух: перенесите в <Notes>`,
    crowdedDiagram: (foundCount, allowedCount) => `В схеме ${foundCount} блоков, больше ${allowedCount}. Сгруппируйте их, покажите по шагам или добавьте <Focus>`,
    longCode: (foundCount, allowedCount) => `${foundCount} строк кода сразу, больше ${allowedCount}. Покажите их по шагам: lines="1-4 | 5-9"`,
    manyColumns: (foundCount, allowedCount) => `${foundCount} колонок, больше ${allowedCount}. Оставьте три, остальное — на следующий слайд`,
    manySections: (foundCount, allowedCount) => `${foundCount} разделов, больше ${allowedCount}. Объедините близкие: доклад из нескольких частей проще удержать`,
    missingHeading: () => `У слайда нет заголовка. Добавьте <h2> с мыслью слайда или сделайте его тезисом, цитатой или мемом`,
    missingAlt: () => `У картинки нет alt. Опишите её парой слов; alt="", если она только для красоты`,
  },
  slideLabel: (slideAddress: string) => `слайд ${slideAddress}`,
  noFindings: (presentationName: string) => `${presentationName}: все слайды по правилам`,
  findingCount: (findingCount: number) => `Замечаний: ${findingCount}. Правила — в llms.txt пакета slidemachina`,
};

export const checkTexts = { en: englishTexts, ru: russianTexts }[pickTextLanguage(Intl.DateTimeFormat().resolvedOptions().locale)];

export function describeFinding({ ruleName, foundCount, allowedCount }: CheckFinding): string {
  return checkTexts.ruleTexts[ruleName](foundCount, allowedCount);
}
