#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "node:util";
import { cancel, intro, isCancel, log, note, outro, select, text } from "@clack/prompts";

const templateFolder = fileURLToPath(new URL("./template", import.meta.url));
const themeTemplateFolder = fileURLToPath(new URL("./theme", import.meta.url));
const defaultFolderNames = { presentation: "my-talk", repository: "my-talks" };

const creatorTextsByLanguage = {
  en: {
    kindQuestion: "What to create?",
    kindHint: "↑↓ and Enter",
    presentationKind: { label: "Presentation", hint: "one folder with index.tsx" },
    repositoryKind: { label: "Repository of presentations", hint: "a shared theme and a list of all presentations" },
    folderQuestion: "Folder for the presentation",
    repositoryFolderQuestion: "Folder for the repository",
    folderNotEmpty: (/** @type {string} */ folderName) => `Folder ${folderName} is not empty: pick another name`,
    creationCancelled: "Nothing created",
    nextStepsTitle: "Next",
    createdProject: (/** @type {string} */ folderName) => `Presentation of 10 slides in ${folderName}`,
    createdRepository: (/** @type {string} */ folderName) => `Repository in ${folderName}: the theme in theme/, the first presentation in my-talk/`,
    finished: "Slides are in index.tsx, the theme is in style.css",
    finishedInRepository: "Slides are in index.tsx, the shared theme is in theme/style.css",
  },
  ru: {
    kindQuestion: "Что создать?",
    kindHint: "↑↓ и Enter",
    presentationKind: { label: "Презентацию", hint: "одна папка с index.tsx" },
    repositoryKind: { label: "Репозиторий презентаций", hint: "общая тема и список всех презентаций" },
    folderQuestion: "Папка для презентации",
    repositoryFolderQuestion: "Папка для репозитория",
    folderNotEmpty: (/** @type {string} */ folderName) => `В папке ${folderName} уже есть файлы: выберите другое имя`,
    creationCancelled: "Ничего не создано",
    nextStepsTitle: "Дальше",
    createdProject: (/** @type {string} */ folderName) => `Презентация на 10 слайдов в папке ${folderName}`,
    createdRepository: (/** @type {string} */ folderName) => `Репозиторий в папке ${folderName}: тема в theme/, первая презентация в my-talk/`,
    finished: "Слайды в index.tsx, тема в style.css",
    finishedInRepository: "Слайды в index.tsx, общая тема в theme/style.css",
  },
};

const systemLanguage = Intl.DateTimeFormat().resolvedOptions().locale;
// A separate package: it cannot import src/text-language.js, so it repeats the same check.
const creatorTexts = systemLanguage.toLowerCase().startsWith("ru") ? creatorTextsByLanguage.ru : creatorTextsByLanguage.en;

/**
 * @template AnswerType
 * @param {AnswerType} promptAnswer
 * @returns {Exclude<AnswerType, symbol>}
 */
function stopWhenCancelled(promptAnswer) {
  if (!isCancel(promptAnswer)) return /** @type {Exclude<AnswerType, symbol>} */ (promptAnswer);
  cancel(creatorTexts.creationCancelled);
  process.exit(0);
}

/** @param {string} folderPath */
function isFolderTaken(folderPath) {
  return existsSync(folderPath) && readdirSync(folderPath).length > 0;
}

/**
 * @param {string} baseFolder
 * @param {string} folderQuestion
 * @param {string} defaultFolderName
 */
async function askFolderName(baseFolder, folderQuestion, defaultFolderName) {
  const folderName = process.argv[2] ?? stopWhenCancelled(await text({
    message: folderQuestion,
    placeholder: defaultFolderName,
    defaultValue: defaultFolderName,
    validate: (typedName) => (typedName && isFolderTaken(path.resolve(baseFolder, typedName)) ? creatorTexts.folderNotEmpty(typedName) : undefined),
  }));
  if (isFolderTaken(path.resolve(baseFolder, folderName))) {
    log.error(creatorTexts.folderNotEmpty(folderName));
    process.exit(1);
  }
  return folderName;
}

// A folder name on the command line keeps the old meaning: a presentation.
async function askProjectKind() {
  if (process.argv[2] !== undefined) return "presentation";
  return stopWhenCancelled(await select({
    message: `${creatorTexts.kindQuestion} ${styleText("dim", creatorTexts.kindHint)}`,
    options: [
      { value: "presentation", ...creatorTexts.presentationKind },
      { value: "repository", ...creatorTexts.repositoryKind },
    ],
    showInstructions: false,
  }));
}

// npm drops .gitignore from published packages, so the template keeps it without the dot.
/** @param {string} projectFolder */
function finishCopiedTemplate(projectFolder) {
  renameSync(path.join(projectFolder, "gitignore"), path.join(projectFolder, ".gitignore"));
  const packageFile = path.join(projectFolder, "package.json");
  const projectPackage = JSON.parse(readFileSync(packageFile, "utf8"));
  projectPackage.name = path.basename(projectFolder);
  writeFileSync(packageFile, `${JSON.stringify(projectPackage, null, 2)}\n`);
}

/** @param {string} projectFolder */
function writeProjectFiles(projectFolder) {
  cpSync(templateFolder, projectFolder, { recursive: true });
  finishCopiedTemplate(projectFolder);
}

/**
 * @param {string} templateText
 * @param {string} searchedText
 * @param {string} replacementText
 */
function replaceOrFail(templateText, searchedText, replacementText) {
  if (!templateText.includes(searchedText)) throw new Error(`template/index.tsx: no "${searchedText}"`);
  return templateText.replace(searchedText, replacementText);
}

// The same slides as a lone presentation, with the logos of the shared theme and today's date for the list.
/** @param {string} presentationFolder */
function writeRepositoryPresentation(presentationFolder) {
  let presentationSource = readFileSync(path.join(templateFolder, "index.tsx"), "utf8");
  presentationSource = replaceOrFail(presentationSource, '"./images/logo-on-dark.svg"', '"../theme/logo-on-dark.svg"');
  presentationSource = replaceOrFail(presentationSource, '"./images/logo.svg"', '"../theme/logo.svg"');
  presentationSource = replaceOrFail(presentationSource, "тема - в style.css", "тема - в theme/style.css");
  const todayDate = new Date().toLocaleDateString("sv");
  presentationSource = replaceOrFail(presentationSource, '<Presentation title="Мой доклад"', `<Presentation title="Мой доклад" date="${todayDate}"`);
  mkdirSync(path.join(presentationFolder, "images"), { recursive: true });
  writeFileSync(path.join(presentationFolder, "index.tsx"), presentationSource);
  cpSync(path.join(templateFolder, "images", "dusk.svg"), path.join(presentationFolder, "images", "dusk.svg"));
}

// The repository root: package.json, tsconfig.json and .gitignore of the template, a theme with its logos, one presentation.
/** @param {string} repositoryFolder */
function writeRepositoryFiles(repositoryFolder) {
  mkdirSync(repositoryFolder, { recursive: true });
  for (const sharedFileName of ["package.json", "tsconfig.json", "gitignore"]) {
    cpSync(path.join(templateFolder, sharedFileName), path.join(repositoryFolder, sharedFileName));
  }
  finishCopiedTemplate(repositoryFolder);
  const themeFolder = path.join(repositoryFolder, "theme");
  cpSync(themeTemplateFolder, themeFolder, { recursive: true });
  for (const logoFileName of ["logo.svg", "logo-on-dark.svg"]) {
    cpSync(path.join(templateFolder, "images", logoFileName), path.join(themeFolder, logoFileName));
  }
  writeRepositoryPresentation(path.join(repositoryFolder, defaultFolderNames.presentation));
}

intro(styleText(["bgBlue", "white"], " slidemachina "));

// Started in a repository root, next to theme/style.css, it adds one more presentation there.
if (existsSync(path.join("theme", "style.css"))) {
  const folderName = await askFolderName(".", creatorTexts.folderQuestion, defaultFolderNames.presentation);
  writeRepositoryPresentation(path.resolve(folderName));
  log.success(creatorTexts.createdProject(folderName));
  note("npm run dev", creatorTexts.nextStepsTitle);
  outro(creatorTexts.finishedInRepository);
} else if ((await askProjectKind()) === "repository") {
  const folderName = await askFolderName(".", creatorTexts.repositoryFolderQuestion, defaultFolderNames.repository);
  writeRepositoryFiles(path.resolve(folderName));
  log.success(creatorTexts.createdRepository(folderName));
  note([`cd ${folderName}`, "npm install", "npm run dev"].join("\n"), creatorTexts.nextStepsTitle);
  outro(creatorTexts.finishedInRepository);
} else {
  const folderName = await askFolderName(".", creatorTexts.folderQuestion, defaultFolderNames.presentation);
  writeProjectFiles(path.resolve(folderName));
  log.success(creatorTexts.createdProject(folderName));
  note([`cd ${folderName}`, "npm install", "npm run dev"].join("\n"), creatorTexts.nextStepsTitle);
  outro(creatorTexts.finished);
}
