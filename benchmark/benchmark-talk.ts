import sharp from "sharp";

export type TalkSlide = { slideHeading: string; listItems?: string[]; showsCode?: boolean; showsPicture?: boolean; speakerNotes?: string };
export type TalkSection = { sectionTitle: string; sectionSlides: TalkSlide[] };

const pictureWidth = 1600;
const pictureHeight = 900;

export const talkTitle = "Slidemachina benchmark";
export const talkSubtitle = "One talk, four tools";
export const closingHeading = "Thank you";
export const closingLead = "Questions?";
export const coverNotes = "Welcome. One talk, four tools, the same content everywhere.";
export const highlightedLanguage = "js";
export const codeExample = [
  'import { readdir, stat } from "node:fs/promises";',
  'import { join } from "node:path";',
  "",
  "export async function measureFolder(folderPath) {",
  "  const folderStats = await stat(folderPath);",
  "  if (!folderStats.isDirectory()) return folderStats.size;",
  "  let totalBytes = 0;",
  "  for (const entryName of await readdir(folderPath)) {",
  "    totalBytes += await measureFolder(join(folderPath, entryName));",
  "  }",
  "  return totalBytes;",
  "}",
  "",
  'const folderBytes = await measureFolder("node_modules");',
  "console.log(`node_modules: ${(folderBytes / 1e6).toFixed(1)} MB`);",
].join("\n");
export const talkSections: TalkSection[] = [
  {
    sectionTitle: "Architecture",
    sectionSlides: [
      { slideHeading: "One file per talk", listItems: ["Slides live in one source file", "The editor checks the markup", "Git keeps the history", "Review works like any code"] },
      { slideHeading: "Steps without markup", listItems: ["One attribute marks a stepped list", "No wrappers per element", "The step survives an edit", "Effects are set once"] },
      { slideHeading: "Sections and covers", listItems: ["A section adds a numbered cover", "Breadcrumbs show the place", "Slides group in the overview", "Seven sections at most"] },
      { slideHeading: "Code on a slide", showsCode: true, speakerNotes: "Highlighting at build time costs nothing in the browser." },
    ],
  },
  {
    sectionTitle: "Performance",
    sectionSlides: [
      { slideHeading: "What we measure", listItems: ["Install size", "Dev server start", "Production build", "Page weight and load"] },
      { slideHeading: "Install", listItems: ["A fresh project per tool", "Latest versions from npm", "node_modules measured after install", "The same registry for all"], speakerNotes: "Numbers are medians of several runs." },
      { slideHeading: "Dev server", listItems: ["From start to the first slide", "Measured in a headless browser", "The same machine for all", "Median of several runs"] },
      { slideHeading: "Build", listItems: ["The production build command", "From start to exit", "No watch mode", "Median of several runs"] },
      { slideHeading: "Output", listItems: ["JavaScript in the build, gzip", "Fonts and pictures as they ship", "The same talk in every tool", "Nothing removed by hand"] },
      { slideHeading: "Load", listItems: ["The build from a static server", "Time to the first heading", "JavaScript memory after load", "Median of several runs"] },
    ],
  },
  {
    sectionTitle: "Tooling",
    sectionSlides: [
      { slideHeading: "Code highlighting", showsCode: true },
      { slideHeading: "A picture", showsPicture: true },
      { slideHeading: "Speaker notes", listItems: ["Notes live next to the slide", "The presenter window shows them", "A timer and the next slide", "Notes work in the build too"] },
      { slideHeading: "Export formats", listItems: ["Static HTML for a website", "PDF with a page per slide", "PowerPoint when HTML is not allowed", "A zip archive to share"] },
      { slideHeading: "Agent workflow", listItems: ["One source file to edit", "A command checks the talk", "A command shoots a slide", "No server to keep running"] },
      { slideHeading: "Summary", listItems: ["Pick the tool that fits", "Markdown, HTML or JSX", "Measure before you choose", "The same talk, four tools"] },
    ],
  },
];

// A plain picture drawn by sharp: every tool ships the same bytes.
export async function writeTalkPicture(picturePath: string): Promise<void> {
  const pictureMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${pictureWidth}" height="${pictureHeight}">
  <defs><linearGradient id="fill" x1="0" x2="1"><stop offset="0" stop-color="#1e3064"/><stop offset="1" stop-color="#646cff"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#fill)"/>
  <circle cx="1200" cy="300" r="180" fill="#ffffff" fill-opacity="0.18"/>
  <rect x="200" y="560" width="900" height="120" rx="24" fill="#ffffff" fill-opacity="0.25"/>
</svg>`;
  await sharp(Buffer.from(pictureMarkup)).png().toFile(picturePath);
}
