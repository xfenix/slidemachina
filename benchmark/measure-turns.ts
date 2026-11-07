// node benchmark/measure-turns.ts [repeat count]
// Measures only the slide-change turns of the repository slidemachina on the benchmark talk.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { measureSlideChangeTurns, serveFolder } from "./benchmark-measurements.ts";
import { writeTalkPicture } from "./benchmark-talk.ts";
import { packRepositoryPackage } from "./prepare-repository-package.ts";
import { benchmarkTools } from "./tool-projects.ts";

const repeatCount = Number(process.argv[2] ?? 9);
process.env.SLIDEMACHINA_BENCHMARK_PACKAGE ??= packRepositoryPackage(mkdtempSync(path.join(os.tmpdir(), "slidemachina-turns-package-")));

const workFolder = mkdtempSync(path.join(os.tmpdir(), "slidemachina-turns-"));
const picturePath = path.join(workFolder, "talk-picture.png");
await writeTalkPicture(picturePath);
const slidemachinaTool = benchmarkTools.find((benchmarkTool) => benchmarkTool.toolName === "slidemachina")!;
const projectFolder = path.join(workFolder, "slidemachina");
mkdirSync(projectFolder, { recursive: true });
slidemachinaTool.writeProject(projectFolder, picturePath);
console.log(`Project: ${projectFolder}`);

const finishedInstall = spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: projectFolder, stdio: "inherit" });
if (finishedInstall.status !== 0) throw new Error("npm install failed");
const finishedBuild = spawnSync("npm", ["run", "build"], { cwd: projectFolder, stdio: "inherit" });
if (finishedBuild.status !== 0) throw new Error("npm run build failed");

const siteFolder = path.join(projectFolder, slidemachinaTool.buildOutputFolder);
const siteServer = await serveFolder(siteFolder);
const { port: sitePort } = siteServer.address() as { port: number };
const chromeBrowser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch({}));
try {
  const slideChangeMilliseconds = await measureSlideChangeTurns(chromeBrowser, `http://127.0.0.1:${sitePort}${slidemachinaTool.developmentPath}`, repeatCount);
  console.log(`Slide change: ${slideChangeMilliseconds.toFixed(0)} ms (median of ${repeatCount})`);
} finally {
  await chromeBrowser.close();
  siteServer.close();
}
