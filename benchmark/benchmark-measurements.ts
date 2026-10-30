import { spawn, spawnSync } from "node:child_process";
import { createReadStream, readdirSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { gzipSync } from "node:zlib";
import { talkTitle } from "./benchmark-talk.ts";
import type { Browser } from "playwright-core";
import type { BenchmarkTool } from "./tool-projects.ts";

export type ToolMeasurements = {
  toolName: string;
  toolVersion: string;
  loadMilliseconds: number;
  heapMegabytes: number;
  javascriptKilobytes: number;
  developmentSeconds: number;
  buildSeconds: number;
  installMegabytes: number;
};

const serverStartLimit = 120_000;
const headingWaitLimit = 120_000;
const pollingPause = 100;
const bytesInKilobyte = 1024;
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

function measureFolderBytes(folderPath: string, isCounted: (fileName: string) => boolean = () => true): number {
  let folderBytes = 0;
  for (const folderEntry of readdirSync(folderPath, { withFileTypes: true })) {
    const entryPath = path.join(folderPath, folderEntry.name);
    if (folderEntry.isDirectory()) folderBytes += measureFolderBytes(entryPath, isCounted);
    else if (folderEntry.isFile() && isCounted(folderEntry.name)) folderBytes += statSync(entryPath).size;
  }
  return folderBytes;
}

function measureJavascriptBytes(folderPath: string): number {
  let javascriptBytes = 0;
  for (const folderEntry of readdirSync(folderPath, { withFileTypes: true })) {
    const entryPath = path.join(folderPath, folderEntry.name);
    if (folderEntry.isDirectory()) javascriptBytes += measureJavascriptBytes(entryPath);
    else if (/\.m?js$/.test(folderEntry.name)) javascriptBytes += gzipSync(readFileSync(entryPath)).length;
  }
  return javascriptBytes;
}

async function waitForHeading(chromeBrowser: Browser, pageAddress: string): Promise<{ elapsedMilliseconds: number; heapBytes: number }> {
  const browserContext = await chromeBrowser.newContext({ viewport: viewportSize });
  const measuredPage = await browserContext.newPage();
  const startTime = performance.now();
  await measuredPage.goto(pageAddress, { waitUntil: "commit" });
  await measuredPage.getByText(talkTitle).first().waitFor({ state: "visible", timeout: headingWaitLimit });
  const elapsedMilliseconds = performance.now() - startTime;
  const heapBytes = await measuredPage.evaluate(() => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
  await browserContext.close();
  return { elapsedMilliseconds, heapBytes };
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
  const installMegabytes = measureFolderBytes(path.join(projectFolder, "node_modules")) / bytesInMegabyte;
  const buildSeconds = await repeatMeasurement(repeatCount, () => measureBuild(projectFolder));
  const siteFolder = path.join(projectFolder, benchmarkTool.buildOutputFolder);
  const javascriptKilobytes = measureJavascriptBytes(siteFolder) / bytesInKilobyte;
  const siteServer = await serveFolder(siteFolder);
  const { port: sitePort } = siteServer.address() as { port: number };
  const loadResults: { elapsedMilliseconds: number; heapBytes: number }[] = [];
  for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) loadResults.push(await waitForHeading(chromeBrowser, `http://127.0.0.1:${sitePort}/`));
  siteServer.close();
  const developmentSeconds = await repeatMeasurement(repeatCount, () => measureDevelopmentStart(benchmarkTool, projectFolder, chromeBrowser));
  return {
    toolName: benchmarkTool.toolName,
    toolVersion: readInstalledVersion(projectFolder, benchmarkTool.versionPackage),
    loadMilliseconds: pickMedian(loadResults.map((loadResult) => loadResult.elapsedMilliseconds)),
    heapMegabytes: pickMedian(loadResults.map((loadResult) => loadResult.heapBytes)) / bytesInMegabyte,
    javascriptKilobytes,
    developmentSeconds,
    buildSeconds,
    installMegabytes,
  };
}
