import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import { commandLineScript, demoFolderName, examplesFolder, findSlideNumber, waitForServer, workspaceFolder } from "./test-helpers.ts";

interface RecordedClip {
  fileName: string;
  startHeading: string;
  stopHeading: string;
  keepsEveryPixel: boolean;
}
interface ShotStill {
  fileName: string;
  slideHeading: string;
}
interface CapturedFrame {
  capturedSeconds: number;
  framePicture: Buffer;
}

const recordingServerPort = 5391;
const serverAddress = `http://localhost:${recordingServerPort}`;
const viewportSize = { width: 1280, height: 720 };
const stillPixelRatio = 2;
const clipPixelRatio = 1;
const headingSelector = "h1, h2";
// A step past the last one opens the slide fully built.
const builtSlideStep = 99;
const settlePauseMilliseconds = 3000;
const leadPauseMilliseconds = 1500;
const pressPauseMilliseconds = 1300;
const tailPauseMilliseconds = 1500;
const largestPressCount = 40;
const shortestFrameSeconds = 1 / 30;
const millisecondsInSecond = 1000;
const frameBorderWidth = 1;
const frameBorderColor = "#d0d7de";
const mixedEncodingQuality = 95;
const encodingEffort = 4;
const mediaFolder = path.join(workspaceFolder, "docs", "readme");
const chromeEndpoint = process.env.SLIDEMACHINA_CHROME_ENDPOINT;
const recordedClips: RecordedClip[] = [
  { fileName: "morph-transition.webp", startHeading: "Морфинг любых блоков", stopHeading: "Тринадцать переходов", keepsEveryPixel: true },
  { fileName: "diagram-steps.webp", startHeading: "Схема собирается по шагам", stopHeading: "Схема перестраивается сама", keepsEveryPixel: true },
  { fileName: "scene-3d.webp", startHeading: "Сцена в 3D", stopHeading: "Свет и цвет из темы", keepsEveryPixel: false },
];
const shotStills: ShotStill[] = [
  { fileName: "slide-code.webp", slideHeading: "Код из файла" },
  { fileName: "slide-typography.webp", slideHeading: "В slidemachina буквы стоят ровно" },
  { fileName: "slide-photo.webp", slideHeading: "Картинка на весь слайд" },
  { fileName: "slide-qr.webp", slideHeading: "Устали генерировать коды на qrcodemonkey?" },
];

// The border keeps a white slide apart from the white GitHub page.
async function drawFrameBorder(slidePicture: Buffer) {
  const resizedPicture = await sharp(slidePicture).resize(viewportSize.width).png().toBuffer();
  return sharp(resizedPicture)
    .extract({
      left: frameBorderWidth,
      top: frameBorderWidth,
      width: viewportSize.width - frameBorderWidth - frameBorderWidth,
      height: viewportSize.height - frameBorderWidth - frameBorderWidth,
    })
    .extend({ top: frameBorderWidth, bottom: frameBorderWidth, left: frameBorderWidth, right: frameBorderWidth, background: frameBorderColor });
}

async function openDemoPage(browserConnection: Browser, pixelRatio: number) {
  const pageContext = await browserConnection.newContext({ viewport: viewportSize, deviceScaleFactor: pixelRatio });
  const demoPage = await pageContext.newPage();
  await demoPage.goto(`${serverAddress}/#1`);
  await demoPage.waitForTimeout(settlePauseMilliseconds);
  return demoPage;
}

async function openSlide(demoPage: Page, slideHash: string) {
  await demoPage.goto(`${serverAddress}/#${slideHash}`);
  await demoPage.waitForTimeout(settlePauseMilliseconds);
}

async function readCurrentSlideNumber(demoPage: Page) {
  const currentHash = await demoPage.evaluate(() => location.hash);
  return Number(currentHash.slice(1).split(".")[0]);
}

async function shootStills(browserConnection: Browser) {
  const demoPage = await openDemoPage(browserConnection, stillPixelRatio);
  for (const shotStill of shotStills) {
    const slideNumber = await findSlideNumber(demoPage, headingSelector, shotStill.slideHeading);
    await openSlide(demoPage, `${slideNumber}.${builtSlideStep}`);
    const framedPicture = await drawFrameBorder(await demoPage.screenshot());
    await framedPicture.webp({ lossless: true }).toFile(path.join(mediaFolder, shotStill.fileName));
  }
  await demoPage.context().close();
}

// Screencast sends a frame on every repaint; a 3D scene repaints at 60 fps, twice what a README clip needs.
function thinCapturedFrames(capturedFrames: CapturedFrame[]) {
  const keptFrames: CapturedFrame[] = [];
  for (const capturedFrame of capturedFrames) {
    const previousFrame = keptFrames.at(-1);
    if (previousFrame === undefined || capturedFrame.capturedSeconds - previousFrame.capturedSeconds >= shortestFrameSeconds) keptFrames.push(capturedFrame);
  }
  return keptFrames;
}

async function encodeClip(capturedFrames: CapturedFrame[], recordedClip: RecordedClip) {
  const framesFolder = mkdtempSync(path.join(os.tmpdir(), "slidemachina-readme-frames-"));
  try {
    const qualityArguments = recordedClip.keepsEveryPixel ? [] : ["-mixed", "-q", String(mixedEncodingQuality)];
    const frameArguments: string[] = [];
    const finalSeconds = capturedFrames.at(-1)!.capturedSeconds + tailPauseMilliseconds / millisecondsInSecond;
    for (const [frameIndex, capturedFrame] of capturedFrames.entries()) {
      const nextSeconds = capturedFrames[frameIndex + 1]?.capturedSeconds ?? finalSeconds;
      const framePath = path.join(framesFolder, `${frameIndex}.png`);
      await (await drawFrameBorder(capturedFrame.framePicture)).png().toFile(framePath);
      frameArguments.push("-d", String(Math.round((nextSeconds - capturedFrame.capturedSeconds) * millisecondsInSecond)), framePath);
    }
    const clipPath = path.join(mediaFolder, recordedClip.fileName);
    execFileSync("img2webp", ["-loop", "0", "-m", String(encodingEffort), ...qualityArguments, ...frameArguments, "-o", clipPath], { stdio: "ignore" });
  } finally {
    rmSync(framesFolder, { recursive: true, force: true });
  }
}

async function recordClip(browserConnection: Browser, recordedClip: RecordedClip) {
  const demoPage = await openDemoPage(browserConnection, clipPixelRatio);
  const startNumber = await findSlideNumber(demoPage, headingSelector, recordedClip.startHeading);
  const stopNumber = await findSlideNumber(demoPage, headingSelector, recordedClip.stopHeading);
  await openSlide(demoPage, String(startNumber));
  const screencastSession = await demoPage.context().newCDPSession(demoPage);
  const capturedFrames: CapturedFrame[] = [];
  screencastSession.on("Page.screencastFrame", (screencastFrame) => {
    capturedFrames.push({ capturedSeconds: screencastFrame.metadata.timestamp ?? 0, framePicture: Buffer.from(screencastFrame.data, "base64") });
    screencastSession.send("Page.screencastFrameAck", { sessionId: screencastFrame.sessionId }).catch(() => {});
  });
  await screencastSession.send("Page.startScreencast", { format: "png" });
  await demoPage.waitForTimeout(leadPauseMilliseconds);
  for (let pressNumber = 0; pressNumber < largestPressCount && (await readCurrentSlideNumber(demoPage)) !== stopNumber; pressNumber += 1) {
    await demoPage.keyboard.press("PageDown");
    await demoPage.waitForTimeout(pressPauseMilliseconds);
  }
  await demoPage.waitForTimeout(tailPauseMilliseconds);
  await screencastSession.send("Page.stopScreencast");
  await demoPage.context().close();
  await encodeClip(thinCapturedFrames(capturedFrames), recordedClip);
}

try {
  execFileSync("img2webp", ["-version"], { stdio: "ignore" });
} catch {
  throw new Error("Нужен img2webp из libwebp: brew install webp");
}
const developmentServer = spawn(process.execPath, [commandLineScript, "dev", path.join(examplesFolder, demoFolderName), "--port", String(recordingServerPort)], {
  env: { ...process.env, SLIDEMACHINA_AGENTATION: "off" },
  stdio: "ignore",
});
try {
  await waitForServer(serverAddress);
  const browserConnection = chromeEndpoint === undefined ? await chromium.launch({ channel: "chrome" }) : await chromium.connectOverCDP(chromeEndpoint);
  try {
    await shootStills(browserConnection);
    for (const recordedClip of recordedClips) await recordClip(browserConnection, recordedClip);
  } finally {
    await browserConnection.close();
  }
} finally {
  developmentServer.kill();
}
