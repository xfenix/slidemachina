import { spawn, spawnSync } from "node:child_process";
import { createReadStream, readdirSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { talkTitle } from "./benchmark-talk.ts";
import type { Browser } from "playwright-core";
import type { BenchmarkTool } from "./tool-projects.ts";

export type ToolMeasurements = {
  toolName: string;
  toolVersion: string;
  loadMilliseconds: number;
  slideChangeMilliseconds: number;
  developmentSeconds: number;
  buildSeconds: number;
  outputMegabytes: number;
  pdfExportSeconds: number | null;
};

type ScreencastFrame = { arrivedAtNodeClock: number; frameData: string };

const serverStartLimit = 120_000;
const headingWaitLimit = 120_000;
const stableFrameWaitLimit = 10_000;
const changedFrameWaitLimit = 10_000;
const quietPeriodMilliseconds = 400;
const screencastQuality = 20;
const pollingPause = 100;
const bytesInMegabyte = 1024 * 1024;
const millisecondsInSecond = 1000;
const viewportSize = { width: 1280, height: 720 };
const localAddressPattern = /https?:\/\/(?:localhost|127\.0\.0\.1):\d+/;
const contentTypes: Record<string, string> = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

function pickMedian(measuredValues: number[]): number {
  const sortedValues = [...measuredValues].sort((firstValue, secondValue) => firstValue - secondValue);
  return sortedValues[Math.floor(sortedValues.length / 2)]!;
}

async function repeatMeasurement(repeatCount: number, measureOnce: () => Promise<number>): Promise<number> {
  const measuredValues: number[] = [];
  for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) measuredValues.push(await measureOnce());
  return pickMedian(measuredValues);
}

function runQuietly(commandName: string, commandArguments: string[], projectFolder: string): void {
  const finishedRun = spawnSync(commandName, commandArguments, { cwd: projectFolder, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  if (finishedRun.status !== 0) throw new Error(`${commandName} ${commandArguments.join(" ")} failed in ${projectFolder}:\n${finishedRun.stderr.slice(-2000)}`);
}

function measureFolderBytes(folderPath: string): number {
  let folderBytes = 0;
  for (const folderEntry of readdirSync(folderPath, { withFileTypes: true })) {
    const entryPath = path.join(folderPath, folderEntry.name);
    if (folderEntry.isDirectory()) folderBytes += measureFolderBytes(entryPath);
    else if (folderEntry.isFile()) folderBytes += statSync(entryPath).size;
  }
  return folderBytes;
}

async function waitUntil(watchCondition: () => boolean, waitLimit: number, waitDescription: string): Promise<void> {
  const waitStart = performance.now();
  while (!watchCondition()) {
    if (performance.now() - waitStart > waitLimit) throw new Error(`Timed out waiting for ${waitDescription}`);
    await new Promise((resolvePause) => setTimeout(resolvePause, pollingPause));
  }
}

// Screencast frames arrive in the Node clock; the page clock offset converts them to one time scale.
// A static page stops sending frames, so "stable" is a quiet period, not two equal frames in a row.
async function waitForScreencastQuiet(screencastFrames: ScreencastFrame[], quietMilliseconds: number): Promise<void> {
  const waitStart = performance.now();
  let lastChangeAt = waitStart;
  let lastSeenCount = screencastFrames.length;
  while (performance.now() - lastChangeAt < quietMilliseconds) {
    if (performance.now() - waitStart > stableFrameWaitLimit) throw new Error("Timed out waiting for a stable screencast frame");
    if (screencastFrames.length !== lastSeenCount) {
      lastSeenCount = screencastFrames.length;
      lastChangeAt = performance.now();
    }
    await new Promise((resolvePause) => setTimeout(resolvePause, pollingPause));
  }
}

async function measureSlideChangeTurns(chromeBrowser: Browser, pageAddress: string, repeatCount: number): Promise<number> {
  const browserContext = await chromeBrowser.newContext({ viewport: viewportSize });
  const measuredPage = await browserContext.newPage();
  await measuredPage.goto(pageAddress, { waitUntil: "commit" });
  await measuredPage.getByText(talkTitle).first().waitFor({ state: "visible", timeout: headingWaitLimit });
  // A painted first slide (slidemachina) is visible before scripts run; it leaves once the app is up and owns the keys.
  await measuredPage.locator("[data-static-cover]").waitFor({ state: "detached", timeout: changedFrameWaitLimit }).catch(() => undefined);
  const nodeClockAtSync = performance.now();
  const pageClockAtSync = await measuredPage.evaluate(() => performance.now());
  const pageClockOffset = pageClockAtSync - nodeClockAtSync;
  const chromeSession = await browserContext.newCDPSession(measuredPage);
  const screencastFrames: ScreencastFrame[] = [];
  chromeSession.on("Page.screencastFrame", (castEvent: { sessionId: number; data: string }) => {
    screencastFrames.push({ arrivedAtNodeClock: performance.now(), frameData: castEvent.data });
    chromeSession.send("Page.screencastFrameAck", { sessionId: castEvent.sessionId }).catch(() => undefined);
  });
  await chromeSession.send("Page.startScreencast", { format: "jpeg", quality: screencastQuality, everyNthFrame: 1 });
  const measuredTurns: number[] = [];
  try {
    await waitUntil(() => screencastFrames.length > 0, stableFrameWaitLimit, "the first screencast frame");
    for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
      await waitForScreencastQuiet(screencastFrames, quietPeriodMilliseconds);
      const stableFrameData = screencastFrames.at(-1)!.frameData;
      await measuredPage.evaluate(() => {
        const keyedWindow = window as unknown as { slideTurnKeyDownAt: number };
        keyedWindow.slideTurnKeyDownAt = 0;
        window.addEventListener(
          "keydown",
          (keyEvent: KeyboardEvent) => {
            if (keyEvent.key === "ArrowRight" && keyedWindow.slideTurnKeyDownAt === 0) keyedWindow.slideTurnKeyDownAt = performance.now();
          },
          true,
        );
      });
      await measuredPage.keyboard.press("ArrowRight");
      await measuredPage.waitForFunction(() => (window as unknown as { slideTurnKeyDownAt: number }).slideTurnKeyDownAt > 0, undefined, { timeout: changedFrameWaitLimit });
      const pressedKeyDownAtPageClock = await measuredPage.evaluate(() => (window as unknown as { slideTurnKeyDownAt: number }).slideTurnKeyDownAt);
      const framesAtPress = screencastFrames.length;
      await waitUntil(
        () => screencastFrames.slice(framesAtPress).some((castFrame) => castFrame.frameData !== stableFrameData),
        changedFrameWaitLimit,
        "a screencast frame different from the stable one",
      );
      const changedFrame = screencastFrames.slice(framesAtPress).find((castFrame) => castFrame.frameData !== stableFrameData)!;
      measuredTurns.push(changedFrame.arrivedAtNodeClock + pageClockOffset - pressedKeyDownAtPageClock);
    }
  } finally {
    await chromeSession.send("Page.stopScreencast").catch(() => undefined);
    await browserContext.close();
  }
  return pickMedian(measuredTurns);
}

async function measureDevelopmentStart(benchmarkTool: BenchmarkTool, projectFolder: string, chromeBrowser: Browser): Promise<number> {
  const startTime = performance.now();
  const serverProcess = spawn("npm", ["run", "dev"], { cwd: projectFolder, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let serverOutput = "";
  const collectOutput = (outputChunk: Buffer) => {
    serverOutput += stripVTControlCharacters(outputChunk.toString());
  };
  serverProcess.stdout.on("data", collectOutput);
  serverProcess.stderr.on("data", collectOutput);
  try {
    let serverAddress: string | undefined;
    while (serverAddress === undefined) {
      if (performance.now() - startTime > serverStartLimit) throw new Error(`${benchmarkTool.toolName} dev server printed no address:\n${serverOutput.slice(-2000)}`);
      serverAddress = localAddressPattern.exec(serverOutput)?.[0];
      await new Promise((resolvePause) => setTimeout(resolvePause, pollingPause));
    }
    const browserContext = await chromeBrowser.newContext({ viewport: viewportSize });
    const measuredPage = await browserContext.newPage();
    // A dev server may print its address a moment before it answers.
    while (!(await measuredPage.goto(`${serverAddress}${benchmarkTool.developmentPath}`, { waitUntil: "commit" }).then(() => true, () => false))) {
      await new Promise((resolvePause) => setTimeout(resolvePause, pollingPause));
    }
    await measuredPage.getByText(talkTitle).first().waitFor({ state: "visible", timeout: headingWaitLimit });
    const elapsedSeconds = (performance.now() - startTime) / millisecondsInSecond;
    await browserContext.close();
    return elapsedSeconds;
  } finally {
    process.kill(-serverProcess.pid!, "SIGKILL");
  }
}

function measureBuild(projectFolder: string): Promise<number> {
  const startTime = performance.now();
  runQuietly("npm", ["run", "build"], projectFolder);
  return Promise.resolve((performance.now() - startTime) / millisecondsInSecond);
}

function findChromeExecutablePath(): string | undefined {
  for (const commandName of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const lookedUpPath = spawnSync("which", [commandName], { encoding: "utf8" }).stdout.trim();
    if (lookedUpPath !== "") return lookedUpPath;
  }
  const puppeteerCacheFolder = path.join(os.homedir(), ".cache", "puppeteer", "chrome");
  const cachedVersionFolders = readdirSync(puppeteerCacheFolder, { withFileTypes: true }).filter((cacheEntry) => cacheEntry.isDirectory());
  for (const versionFolder of cachedVersionFolders.sort((firstEntry, secondEntry) => firstEntry.name.localeCompare(secondEntry.name))) {
    const candidatePath = path.join(puppeteerCacheFolder, versionFolder.name, "chrome-linux64", "chrome");
    if (statSync(candidatePath, { throwIfNoEntry: false })?.isFile() === true) return candidatePath;
  }
  return undefined;
}

function measurePdfExport(projectFolder: string, exportScript: string): Promise<number> {
  const startTime = performance.now();
  const chromeExecutablePath = findChromeExecutablePath();
  // Decktape drives Chrome through puppeteer; a found Chrome saves its postinstall download.
  const launchEnvironment = chromeExecutablePath === undefined ? process.env : { ...process.env, PUPPETEER_EXECUTABLE_PATH: chromeExecutablePath };
  const finishedRun = spawnSync("npm", ["run", exportScript], { cwd: projectFolder, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", env: launchEnvironment });
  if (finishedRun.status !== 0) throw new Error(`npm run ${exportScript} failed in ${projectFolder}:\n${finishedRun.stderr.slice(-2000)}`);
  return Promise.resolve((performance.now() - startTime) / millisecondsInSecond);
}

function serveFolder(siteFolder: string): Promise<http.Server> {
  const siteServer = http.createServer((siteRequest, siteResponse) => {
    const requestPath = decodeURIComponent((siteRequest.url ?? "/").split("?")[0]!);
    const candidatePath = path.join(siteFolder, requestPath);
    const filePath = statSync(candidatePath, { throwIfNoEntry: false })?.isFile() === true ? candidatePath : path.join(siteFolder, "index.html");
    siteResponse.setHeader("content-type", contentTypes[path.extname(filePath)] ?? "application/octet-stream");
    createReadStream(filePath).pipe(siteResponse);
  });
  return new Promise((resolveServer) => siteServer.listen(0, "127.0.0.1", () => resolveServer(siteServer)));
}

function readInstalledVersion(projectFolder: string, packageName: string): string {
  return (JSON.parse(readFileSync(path.join(projectFolder, "node_modules", packageName, "package.json"), "utf8")) as { version: string }).version;
}

export async function measureTool(benchmarkTool: BenchmarkTool, projectFolder: string, chromeBrowser: Browser, repeatCount: number): Promise<ToolMeasurements> {
  runQuietly("npm", ["install", "--no-audit", "--no-fund"], projectFolder);
  const buildSeconds = await repeatMeasurement(repeatCount, () => measureBuild(projectFolder));
  const siteFolder = path.join(projectFolder, benchmarkTool.buildOutputFolder);
  const outputMegabytes = measureFolderBytes(siteFolder) / bytesInMegabyte;
  const siteServer = await serveFolder(siteFolder);
  const { port: sitePort } = siteServer.address() as { port: number };
  const loadMilliseconds = await repeatMeasurement(repeatCount, async () => {
    const browserContext = await chromeBrowser.newContext({ viewport: viewportSize });
    const measuredPage = await browserContext.newPage();
    const pageLoadStart = performance.now();
    await measuredPage.goto(`http://127.0.0.1:${sitePort}/`, { waitUntil: "commit" });
    await measuredPage.getByText(talkTitle).first().waitFor({ state: "visible", timeout: headingWaitLimit });
    const loadMilliseconds = performance.now() - pageLoadStart;
    await browserContext.close();
    return loadMilliseconds;
  });
  const slideChangeMilliseconds = await measureSlideChangeTurns(chromeBrowser, `http://127.0.0.1:${sitePort}${benchmarkTool.developmentPath}`, repeatCount);
  siteServer.close();
  const exportScript = benchmarkTool.exportScript;
  const pdfExportSeconds = exportScript === undefined ? null : await repeatMeasurement(repeatCount, () => measurePdfExport(projectFolder, exportScript));
  const developmentSeconds = await repeatMeasurement(repeatCount, () => measureDevelopmentStart(benchmarkTool, projectFolder, chromeBrowser));
  return {
    toolName: benchmarkTool.toolName,
    toolVersion: readInstalledVersion(projectFolder, benchmarkTool.versionPackage),
    loadMilliseconds,
    slideChangeMilliseconds,
    developmentSeconds,
    buildSeconds,
    outputMegabytes,
    pdfExportSeconds,
  };
}
