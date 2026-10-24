import { pickTextLanguage } from "../../shared-between-runtimes/text-language.ts";

const systemLanguage = Intl.DateTimeFormat().resolvedOptions().locale;

const englishTexts = {
  usage: [
    "Usage:",
    "  slidemachina dev [folder] [--port 5173]   start the presentation in development mode",
    "  slidemachina build [folder] [variants]    build the presentation; without variants it asks",
    "",
    "In a repository of presentations, a folder with presentation folders and a shared theme/:",
    "  slidemachina dev                          the list of presentations, any of them opens with a click",
    "  slidemachina dev my-talk                  one presentation with the shared theme",
    "  slidemachina build [variants]             every presentation and the list: dist/ is ready for a web server",
    "",
    "Build variants:",
    "  --html          one HTML file with pictures and fonts inside",
    "  --protected     one HTML file behind a password: asked for, or taken from SLIDEMACHINA_PASSWORD",
    "  --folder        a folder for a website",
    "  --zip           the same folder in a zip archive",
    "  --pdf           PDF, a page per slide; with --steps a page per step",
    "  --out <folder>  where to put the result, dist by default",
  ].join("\n"),
  missingPresentationFile: (projectFolder: string) =>
    `No index.tsx and no presentation folders in ${projectFolder}.\nRun the command in the presentation folder or pass the folder: slidemachina dev my-talk`,
  missingCodeFile: (codeFilePath: string) => `<Code src>: file ${codeFilePath} not found.`,
  unknownFlag: (flagText: string) => `There is no flag ${flagText}`,
  wrongFlag: (flagText: string) => `Check the flag ${flagText}`,
  wrongPort: (portText: string) => `The port is a whole number from 1 to 65535, not "${portText}"`,
  outputOverSources: (outputFolder: string) =>
    `${outputFolder} is the source folder or a folder above it. The build would erase the slides. Choose another folder with --out`,
  outputHoldsSources: (folderPath: string) => `${folderPath} holds an index.tsx. The build does not erase sources. Choose another folder with --out`,
  shortSecret: "The password is shorter than 14 characters: a file behind it can be cracked by brute force. Take a longer one",
  buildQuestion: "What to build?",
  buildKeysHint: "↑↓ and Enter",
  buildVariants: {
    html: { label: "One HTML file", hint: "opens with a double click, fits a chat or an email" },
    protected: { label: "HTML file with a password", hint: "the same file, opens after the password" },
    folder: { label: "Folder for a website", hint: "pictures and diagrams load when needed" },
    zip: { label: "Folder in a zip", hint: "one file to upload to hosting" },
    pdf: { label: "PDF", hint: "a page per slide" },
    "pdf-steps": { label: "PDF by steps", hint: "a page per step: list items, code lines, diagram parts" },
  },
  passwordQuestion: "Password for the file",
  emptyPassword: "Type at least 1 character",
  buildCancelled: "Build cancelled",
  missingPassword: "--protected needs a password: --password or SLIDEMACHINA_PASSWORD",
  nonInteractiveBuild: "Choose what to build: --html, --protected, --folder, --zip or --pdf",
  repositoryPageConflict: "In a repository every presentation opens from its index.html. Choose one of --html, --protected and --folder",
  shootingCover: "Taking the cover for the list",
  coversWithoutChrome: "Covers need Google Chrome. The list shows titles without covers",
  coverFailed: (folderName: string, problemText: string) => `No cover for ${folderName}: ${problemText}`,
  buildingList: "Building the list of presentations",
  listServingHint: (folderPath: string) => `Put ${folderPath} on a web server as it is. To look at it here: npx serve ${folderPath}`,
  buildingFiles: (isSingleFile: boolean): string => (isSingleFile ? "Building one HTML file" : "Building the folder"),
  printingPdf: (printsSteps: boolean): string => (printsSteps ? "Printing PDF by steps" : "Printing PDF"),
  encryptingFile: "Encrypting the file",
  builtOutput: (outputPath: string, outputSize: string) => `${outputPath}  ${outputSize}`,
  folderServingHint: (folderPath: string) => `A browser runs the folder only from a web server: npx serve ${folderPath}`,
  largeSingleFile: (fileName: string, fileSize: string) =>
    `${fileName} weighs ${fileSize}. Mail and chats often refuse files over 50 MB: build a folder or a zip`,
  keptVideo: (videoName: string, videoSize: string) => `Video ${videoName}, ${videoSize}: the build keeps videos as they are`,
  compressedPictures: (pictureCount: number, savedSize: string) => `Pictures in WebP: ${pictureCount}, the build is ${savedSize} lighter`,
  missingChrome: "PDF needs Google Chrome. Install it and run the build again",
  buildFinished: (elapsedSeconds: string) => `Done in ${elapsedSeconds} s`,
  passwordPage: {
    instructions: "Type the password to open the slides",
    placeholder: "Password",
    button: "Open",
    remember: "Remember on this device",
    error: "Wrong password",
    showPassword: "Show password",
    hidePassword: "Hide password",
  },
};

const russianTexts: typeof englishTexts = {
  usage: [
    "Как запустить:",
    "  slidemachina dev [папка] [--port 5173]   открыть презентацию в режиме разработки",
    "  slidemachina build [папка] [варианты]    собрать презентацию; без вариантов спросит, что собрать",
    "",
    "В репозитории презентаций, то есть в папке с папками презентаций и общей темой theme/:",
    "  slidemachina dev                         список презентаций, любая открывается по клику",
    "  slidemachina dev my-talk                 одна презентация с общей темой",
    "  slidemachina build [варианты]            все презентации и список: папку dist/ можно сразу выложить на сервер",
    "",
    "Варианты сборки:",
    "  --html          один HTML-файл, картинки и шрифты внутри",
    "  --protected     один HTML-файл под паролем: спросит его или возьмёт из SLIDEMACHINA_PASSWORD",
    "  --folder        папка для сайта",
    "  --zip           та же папка в zip-архиве",
    "  --pdf           PDF, страница на слайд; с --steps — страница на шаг",
    "  --out <папка>   куда положить результат, по умолчанию dist",
  ].join("\n"),
  missingPresentationFile: (projectFolder) =>
    `В папке ${projectFolder} нет ни index.tsx, ни папок с презентациями.\nЗапустите команду в папке презентации или укажите папку: slidemachina dev my-talk`,
  missingCodeFile: (codeFilePath) => `<Code src>: нет файла ${codeFilePath}.`,
  unknownFlag: (flagText) => `Нет флага ${flagText}`,
  wrongFlag: (flagText) => `Проверьте флаг ${flagText}`,
  wrongPort: (portText) => `Порт — целое число от 1 до 65535, а не «${portText}»`,
  outputOverSources: (outputFolder) =>
    `${outputFolder} — папка с исходниками или папка над ней. Сборка стёрла бы слайды. Укажите в --out другую папку`,
  outputHoldsSources: (folderPath) => `В ${folderPath} лежит index.tsx. Сборка не стирает исходники. Укажите в --out другую папку`,
  shortSecret: "Пароль короче 14 знаков: файл под таким паролем вскроют перебором. Возьмите пароль длиннее",
  buildQuestion: "Что собрать?",
  buildKeysHint: "↑↓ и Enter",
  buildVariants: {
    html: { label: "Один HTML-файл", hint: "открывается двойным щелчком, можно отправить в чат или письмом" },
    protected: { label: "HTML-файл под паролем", hint: "тот же файл, слайды видны после пароля" },
    folder: { label: "Папка для сайта", hint: "картинки и схемы грузятся, когда нужны" },
    zip: { label: "Папка в zip", hint: "один файл, чтобы загрузить на хостинг" },
    pdf: { label: "PDF", hint: "страница на слайд" },
    "pdf-steps": { label: "PDF по шагам", hint: "страница на каждый шаг: пункты, строки кода, части схем" },
  },
  passwordQuestion: "Пароль для файла",
  emptyPassword: "Нужен хотя бы 1 символ",
  buildCancelled: "Сборка отменена",
  missingPassword: "Для --protected нужен пароль: --password или SLIDEMACHINA_PASSWORD",
  nonInteractiveBuild: "Укажите, что собрать: --html, --protected, --folder, --zip или --pdf",
  repositoryPageConflict: "В репозитории каждая презентация открывается из своего index.html. Выберите что-то одно: --html, --protected или --folder",
  shootingCover: "Снимаю обложку для списка",
  coversWithoutChrome: "Для обложек нужен Google Chrome. В списке будут только названия",
  coverFailed: (folderName, problemText) => `Не получилось снять обложку ${folderName}: ${problemText}`,
  buildingList: "Собираю список презентаций",
  listServingHint: (folderPath) => `Папку ${folderPath} можно выложить на сервер как есть. Посмотреть здесь: npx serve ${folderPath}`,
  buildingFiles: (isSingleFile) => (isSingleFile ? "Собираю один HTML-файл" : "Собираю папку"),
  printingPdf: (printsSteps) => (printsSteps ? "Печатаю PDF по шагам" : "Печатаю PDF"),
  encryptingFile: "Шифрую файл",
  builtOutput: (outputPath, outputSize) => `${outputPath}  ${outputSize}`,
  folderServingHint: (folderPath) => `Браузер запустит папку только с веб-сервера: npx serve ${folderPath}`,
  largeSingleFile: (fileName, fileSize) =>
    `${fileName} весит ${fileSize}. Почта и мессенджеры часто не берут файлы больше 50 МБ: соберите папку или zip`,
  keptVideo: (videoName, videoSize) => `Видео ${videoName}, ${videoSize}: сборка не сжимает видео`,
  compressedPictures: (pictureCount, savedSize) => `Картинки в WebP: ${pictureCount}, сборка легче на ${savedSize}`,
  missingChrome: "Для PDF нужен Google Chrome. Установите его и запустите сборку снова",
  buildFinished: (elapsedSeconds) => `Готово за ${elapsedSeconds} с`,
  passwordPage: {
    instructions: "Введите пароль, чтобы открыть слайды",
    placeholder: "Пароль",
    button: "Открыть",
    remember: "Запомнить на этом устройстве",
    error: "Пароль не подошёл",
    showPassword: "Показать пароль",
    hidePassword: "Скрыть пароль",
  },
};

const commandLineTextsByLanguage = { en: englishTexts, ru: russianTexts };

export const commandLineLanguage = pickTextLanguage(systemLanguage);
export const commandLineTexts = commandLineTextsByLanguage[commandLineLanguage];

// "3,1 МБ" or "3.1 MB", in the language of the system.
export function formatFileSize(byteCount: number): string {
  const sizeUnit = byteCount < 1024 * 1024 ? "kilobyte" : "megabyte";
  const unitValue = byteCount / (sizeUnit === "kilobyte" ? 1024 : 1024 * 1024);
  return new Intl.NumberFormat(commandLineLanguage, { style: "unit", unit: sizeUnit, maximumFractionDigits: 1 }).format(unitValue);
}
