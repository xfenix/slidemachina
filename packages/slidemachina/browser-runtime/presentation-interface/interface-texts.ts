import { pickTextLanguage } from "../../shared-between-runtimes/text-language.js";
const interfaceTextsByLanguage = {
  en: {
    navigatorLabel: "Slides",
    toolbarLabel: "Presentation controls",
    navigatorButton: "All slides · Esc",
    fullscreenButton: "Full screen · F",
    hideToolbarButton: "Hide controls · H",
    showToolbarButton: "Show controls · H",
    backToListButton: "All presentations",
    jumpPrompt: "Go to slide",
    printButton: "Print",
    printSlidesTitle: "Slides",
    printSlidesHint: "One page per slide",
    printStepsTitle: "Slides by steps",
    printStepsHint: "One page per step",
    printShortcutHint: (printShortcut: string, printsSteps: boolean) =>
      `${printShortcut} prints one page per ${printsSteps ? "step" : "slide"}`,
    slideOutsidePresentation: "<Slide> works only inside <Presentation>.",
    missingArrowEnd: (partIdentifier: string) => `The arrow is not drawn: there is no "${partIdentifier}" on the diagram.`,
  },
  ru: {
    navigatorLabel: "Слайды",
    toolbarLabel: "Управление презентацией",
    navigatorButton: "Все слайды · Esc",
    fullscreenButton: "Полный экран · F",
    hideToolbarButton: "Скрыть панель · H",
    showToolbarButton: "Показать панель · H",
    backToListButton: "Все презентации",
    jumpPrompt: "Перейти к слайду",
    printButton: "Печать",
    printSlidesTitle: "Слайды",
    printSlidesHint: "Страница на слайд",
    printStepsTitle: "Слайды по шагам",
    printStepsHint: "Страница на каждый шаг",
    printShortcutHint: (printShortcut: string, printsSteps: boolean) =>
      `${printShortcut} печатает страницу на каждый ${printsSteps ? "шаг" : "слайд"}`,
    slideOutsidePresentation: "<Slide> работает только внутри <Presentation>.",
    missingArrowEnd: (partIdentifier: string) => `Стрелка не нарисована: на схеме нет «${partIdentifier}».`,
  },
};

export function pickInterfaceTexts(languageCode: string) {
  return interfaceTextsByLanguage[pickTextLanguage(languageCode)];
}
