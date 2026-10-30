// node benchmark/run-benchmark.ts <output folder>
// The same talk in the latest slidemachina, reveal.js, Slidev and open-slide from npm: install, dev server, build, page weight, load.
// SLIDEMACHINA_BENCHMARK_CHROME_ENDPOINT connects to a running Chrome instead of starting one.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { drawBenchmarkChart, writeResultsTable } from "./benchmark-chart.ts";
import { measureTool } from "./benchmark-measurements.ts";
import { talkSections, writeTalkPicture } from "./benchmark-talk.ts";
import { benchmarkTools } from "./tool-projects.ts";
import type { ToolMeasurements } from "./benchmark-measurements.ts";

const repeatCount = 5;
// The cover, the closing slide and a cover per section come on top of the content slides.
const framingSlideCount = 2;
const outputFolder = process.argv[2];
if (outputFolder === undefined) throw new Error("Usage: node benchmark/run-benchmark.ts <output folder>");

const workFolder = mkdtempSync(path.join(os.tmpdir(), "slidemachina-benchmark-"));
const picturePath = path.join(workFolder, "talk-picture.png");
await writeTalkPicture(picturePath);
const chromeEndpoint = process.env.SLIDEMACHINA_BENCHMARK_CHROME_ENDPOINT;
const chromeBrowser = chromeEndpoint === undefined ? await chromium.launch({ channel: "chrome", args: ["--enable-precise-memory-info"] }) : await chromium.connectOverCDP(chromeEndpoint);

const toolMeasurements: ToolMeasurements[] = [];
try {
  for (const benchmarkTool of benchmarkTools) {
    const projectFolder = path.join(workFolder, benchmarkTool.toolName.toLowerCase());
    mkdirSync(projectFolder, { recursive: true });
    benchmarkTool.writeProject(projectFolder, picturePath);
    console.log(`Measuring ${benchmarkTool.toolName}`);
    toolMeasurements.push(await measureTool(benchmarkTool, projectFolder, chromeBrowser, repeatCount));
  }
} finally {
  await chromeBrowser.close();
}

const measuredDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const machineLabel = process.env.GITHUB_ACTIONS === "true" ? "GitHub Actions ubuntu-latest" : `${os.type()} ${os.arch()}`;
const slideCount = framingSlideCount + talkSections.reduce((slideTotal, talkSection) => slideTotal + 1 + talkSection.sectionSlides.length, 0);
mkdirSync(outputFolder, { recursive: true });
writeFileSync(path.join(outputFolder, "benchmark.svg"), drawBenchmarkChart(toolMeasurements, measuredDate, repeatCount, slideCount, machineLabel));
writeFileSync(path.join(outputFolder, "benchmark.json"), `${JSON.stringify({ measuredDate, repeatCount, slideCount, toolMeasurements }, null, 2)}\n`);
const resultsTable = writeResultsTable(toolMeasurements);
writeFileSync(
  path.join(outputFolder, "README.md"),
  `# slidemachina benchmark\n\n${measuredDate}. The same talk of ${slideCount} slides in the latest versions from npm, median of ${repeatCount} runs.\nThe method is in [benchmark/](https://github.com/xfenix/slidemachina/tree/main/benchmark) of the main branch.\n\n![The benchmark](benchmark.svg)\n\n${resultsTable}\n`,
);
console.log(resultsTable);
