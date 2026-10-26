import { pickRussianPlural, pickTextLanguage } from "../../shared-between-runtimes/text-language.js";
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
    printNowTitle: "Print",
    printViewTitle: "Print view",
    printViewHint: "All pages in the browser",
    printStepsTitle: "Every step",
    printStepsHint: "A page per step, not per slide",
    printViewBackButton: "Back to slides · Esc",
    printViewPageCount: (pageCount: number) => `${pageCount} ${pageCount === 1 ? "page" : "pages"}`,
    slideOutsidePresentation: "<Slide> works only inside <Presentation>.",
    missingArrowEnd: (partIdentifier: string) => `The arrow is not drawn: there is no "${partIdentifier}" on the diagram.`,
    wrongAspectRatio: (aspectRatioText: string) =>
      `<Presentation aspectRatio="${aspectRatioText}">: write the width and height as two positive numbers, like "16:9", "4:3" or "9:16".`,
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
    printNowTitle: "Распечатать",
    printViewTitle: "Печатная версия",
    printViewHint: "Все страницы в браузере",
    printStepsTitle: "Раскадровка",
    printStepsHint: "Страница на каждый шаг",
    printViewBackButton: "К презентации · Esc",
    printViewPageCount: (pageCount: number) => `${pageCount} ${pickRussianPlural(pageCount, ["страница", "страницы", "страниц"])}`,
    slideOutsidePresentation: "<Slide> работает только внутри <Presentation>.",
    missingArrowEnd: (partIdentifier: string) => `Стрелка не нарисована: на схеме нет «${partIdentifier}».`,
    wrongAspectRatio: (aspectRatioText: string) =>
      `<Presentation aspectRatio="${aspectRatioText}">: нужны ширина и высота через двоеточие, оба числа больше нуля. Например, "16:9", "4:3" или "9:16".`,
  },
};


export function pickInterfaceTexts(languageCode: string) {
  return interfaceTextsByLanguage[pickTextLanguage(languageCode)];
}
