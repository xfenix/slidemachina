import { pickTextLanguage } from "../../shared-between-runtimes/text-language.js";
const editorTextsByLanguage = {
  en: {
    editorButton: "Editor · E",
    editorHint: "Text: click and type. Picture: drop a file on it. Diagram box: drag it",
    textKind: "Text",
    pictureKind: "Picture",
    boxKind: "Box",
    textEditingHint: "Enter saves · Esc cancels",
    pictureHint: "Click or drop a file",
    pictureDropHint: "Drop to replace",
    boxPlaceHint: (columnNumber: number, placeNumber: number) => `Column ${columnNumber} · place ${placeNumber}`,
    savingStatus: "Saving…",
    savedStatus: (sourceFile: string) => `Saved to ${sourceFile}`,
    dropOutsidePicture: "Drop the file onto a picture",
    problems: {
      fileChanged: "The file was changed in the code editor. The slide is updated, try again",
      elementMissing: "This element is no longer in the file. Save the file and try again",
      textHasMarkup: "This text has markup inside. Edit it in the code",
      emptyText: "The text is empty. Nothing is saved",
      pictureExpression: "This picture comes from an expression. Replace it in the code",
      pictureType: "Only pictures fit: PNG, JPEG, WebP, AVIF, GIF, SVG",
      pictureTooLarge: "The file is larger than 80 MB",
      boxOutsideLevel: "A box moves only inside its own group",
      serverUnreachable: "The dev server does not answer. Check that slidemachina dev is running",
      writeFailed: "Could not save the file. The details are in the terminal",
      wrongRequest: "Could not save the file. The details are in the terminal",
    },
  },
  ru: {
    editorButton: "Редактор · E",
    editorHint: "Текст: нажмите и пишите. Картинка: перетащите на неё файл. Блок схемы: тяните мышью",
    textKind: "Текст",
    pictureKind: "Картинка",
    boxKind: "Блок",
    textEditingHint: "Enter сохранит · Esc отменит",
    pictureHint: "Нажмите или перетащите файл",
    pictureDropHint: "Отпустите, чтобы заменить",
    boxPlaceHint: (columnNumber: number, placeNumber: number) => `Колонка ${columnNumber} · место ${placeNumber}`,
    savingStatus: "Сохраняю…",
    savedStatus: (sourceFile: string) => `Сохранено в ${sourceFile}`,
    dropOutsidePicture: "Перетащите файл на картинку",
    problems: {
      fileChanged: "Файл изменили в редакторе кода. Слайд обновился, повторите правку",
      elementMissing: "Этого элемента уже нет в файле. Сохраните файл и повторите",
      textHasMarkup: "В тексте есть разметка. Его можно править только в коде",
      emptyText: "Текст пустой. Ничего не сохранено",
      pictureExpression: "Картинку задаёт выражение. Замените её в коде",
      pictureType: "Подходят только картинки: PNG, JPEG, WebP, AVIF, GIF, SVG",
      pictureTooLarge: "Файл больше 80 МБ",
      boxOutsideLevel: "Блок двигается только внутри своей группы",
      serverUnreachable: "Сервер разработки не отвечает. Проверьте, что запущен slidemachina dev",
      writeFailed: "Не удалось сохранить файл. Подробности в терминале",
      wrongRequest: "Не удалось сохранить файл. Подробности в терминале",
    },
  },
};

export type EditorTexts = (typeof editorTextsByLanguage)["en"];
export type SourceEditProblemCode = keyof EditorTexts["problems"];

export function pickEditorTexts(languageCode: string): EditorTexts {
  return editorTextsByLanguage[pickTextLanguage(languageCode)];
}
