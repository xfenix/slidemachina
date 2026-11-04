import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import { commandLineScript, demoFolderName, examplesFolder, waitForServer, workspaceFolder } from "./test-helpers.ts";

interface CapturedFrame {
  framePicture: Buffer;
}
interface ClipSegment {
  capturedFrames: CapturedFrame[];
  segmentDurationSeconds: number;
  framesArePhoneScreen: boolean;
}

const recordingServerPort = 5392;
const brokerServerPort = 9300;
const serverAddress = `http://localhost:${recordingServerPort}`;
const deckViewportSize = { width: 1280, height: 720 };
const phoneViewportSize = { width: 390, height: 760 };
const mediaFolder = path.join(workspaceFolder, "docs", "readme");
const clipFileName = "remote-control.webp";
const remotePanelButtonLabel = "Пульт с телефона";
const hostingCodeSelector = "[data-remote-code]";
const remotePositionSelector = "[data-remote-position]";
const moveForwardSelector = '[data-remote-move="forward"]';
const firstSlidePositionText = "Слайд 1 из";
const settlePauseMilliseconds = 2500;
const panelLeadMilliseconds = 800;
const panelWakeMilliseconds = 400;
const panelTailMilliseconds = 1600;
const phoneConnectedPauseMilliseconds = 700;
const betweenTapsPauseMilliseconds = 700;
const deckTailMilliseconds = 1500;
const lastFrameHoldMilliseconds = 1400;
const phoneConnectedTimeoutMilliseconds = 30_000;
const loopbackProbeTimeoutMilliseconds = 4000;
const shortestFrameSeconds = 1 / 30;
const millisecondsInSecond = 1000;
const frameBorderWidth = 1;
const frameBorderColor = "#d0d7de";
const phoneCanvasColor = "#0d1117";
const phoneFrameFitHeight = 688;
const encodingEffort = 4;
const chromeEndpoint = process.env.SLIDEMACHINA_CHROME_ENDPOINT;

// The border keeps a white slide apart from the white GitHub page.
async function drawFrameBorder(slidePicture: Buffer) {
  const resizedPicture = await sharp(slidePicture).resize(deckViewportSize.width).png().toBuffer();
  return sharp(resizedPicture)
    .extract({
      left: frameBorderWidth,
      top: frameBorderWidth,
      width: deckViewportSize.width - frameBorderWidth - frameBorderWidth,
      height: deckViewportSize.height - frameBorderWidth - frameBorderWidth,
    })
    .extend({ top: frameBorderWidth, bottom: frameBorderWidth, left: frameBorderWidth, right: frameBorderWidth, background: frameBorderColor })
    .toBuffer();
}

// The phone screen is taller than the deck frame: it is scaled to fit and centered on a dark canvas.
async function composePhoneFrame(phonePicture: Buffer) {
  const borderedPhone = await sharp(phonePicture)
    .resize({ height: phoneFrameFitHeight })
    .extend({ top: frameBorderWidth, bottom: frameBorderWidth, left: frameBorderWidth, right: frameBorderWidth, background: frameBorderColor })
    .png()
    .toBuffer();
  const phoneMetadata = await sharp(borderedPhone).metadata();
  return sharp({
    create: { width: deckViewportSize.width, height: deckViewportSize.height, channels: 3, background: phoneCanvasColor },
  })
    .composite([{ input: borderedPhone, left: Math.round((deckViewportSize.width - phoneMetadata.width!) / 2), top: Math.round((deckViewportSize.height - phoneMetadata.height!) / 2) }])
    .png()
    .toBuffer();
}

// Screencast sends a frame on every repaint. Browser frame timestamps come out quantized on a mostly static
// page, so the clip takes durations from the wall clock of the whole segment: every frame gets an equal
// share, the last one of the segment holds a bit longer.
async function captureScreencast(recordedPage: Page, framesArePhoneScreen: boolean, recordedActions: () => Promise<void>): Promise<ClipSegment> {
  const screencastSession = await recordedPage.context().newCDPSession(recordedPage);
  const capturedFrames: { receivedSeconds: number; framePicture: Buffer }[] = [];
  screencastSession.on("Page.screencastFrame", (screencastFrame) => {
    capturedFrames.push({ receivedSeconds: Date.now() / millisecondsInSecond, framePicture: Buffer.from(screencastFrame.data, "base64") });
    screencastSession.send("Page.screencastFrameAck", { sessionId: screencastFrame.sessionId }).catch(() => {});
  });
  await screencastSession.send("Page.startScreencast", { format: "png" });
  const segmentStartedSeconds = Date.now() / millisecondsInSecond;
  await recordedActions();
  const segmentDurationSeconds = Date.now() / millisecondsInSecond - segmentStartedSeconds;
  await screencastSession.send("Page.stopScreencast");
  await screencastSession.detach();
  const keptFrames: CapturedFrame[] = [];
  let lastKeptReceivedSeconds = Number.NEGATIVE_INFINITY;
  for (const capturedFrame of capturedFrames) {
    if (capturedFrame.receivedSeconds - lastKeptReceivedSeconds < shortestFrameSeconds) continue;
    keptFrames.push({ framePicture: capturedFrame.framePicture });
    lastKeptReceivedSeconds = capturedFrame.receivedSeconds;
  }
  return { capturedFrames: keptFrames, segmentDurationSeconds, framesArePhoneScreen };
}

async function encodeSegments(clipSegments: ClipSegment[]) {
  const framesFolder = mkdtempSync(path.join(os.tmpdir(), "slidemachina-remote-frames-"));
  try {
    const frameArguments: string[] = [];
    let frameIndex = 0;
    for (const clipSegment of clipSegments) {
      const segmentFrames = clipSegment.capturedFrames;
      const perFrameMilliseconds = Math.max(
        (shortestFrameSeconds * millisecondsInSecond) / 2,
        (clipSegment.segmentDurationSeconds * millisecondsInSecond) / segmentFrames.length,
      );
      for (const [segmentFrameIndex, capturedFrame] of segmentFrames.entries()) {
        const framedPicture = clipSegment.framesArePhoneScreen ? await composePhoneFrame(capturedFrame.framePicture) : await drawFrameBorder(capturedFrame.framePicture);
        const framePath = path.join(framesFolder, `${frameIndex}.png`);
        await sharp(framedPicture).png().toFile(framePath);
        const isLastSegmentFrame = segmentFrameIndex === segmentFrames.length - 1;
        const frameDurationMilliseconds = perFrameMilliseconds + (isLastSegmentFrame ? lastFrameHoldMilliseconds : 0);
        frameArguments.push("-d", String(Math.round(frameDurationMilliseconds)), framePath);
        frameIndex += 1;
      }
    }
    execFileSync("img2webp", ["-loop", "0", "-m", String(encodingEffort), ...frameArguments, "-o", path.join(mediaFolder, clipFileName)], { stdio: "ignore" });
  } finally {
    rmSync(framesFolder, { recursive: true, force: true });
  }
}

// The recording machine must connect two of its own tabs over WebRTC. Some corporate VPNs hijack every
// interface so local UDP dies: the probe connects two peer connections inside the page and stops with a clear
// reason instead of recording an empty clip. CI runners pass the probe, that is where this script runs.
async function probeWebRtcLoopback(probePage: Page): Promise<boolean> {
  return probePage.evaluate(async (probeTimeoutMs) => {
    const firstConnection = new RTCPeerConnection({ iceServers: [] });
    const secondConnection = new RTCPeerConnection({ iceServers: [] });
    const probeChannel = firstConnection.createDataChannel("probe");
    const channelOpened = new Promise<boolean>((resolve) => {
      probeChannel.onopen = () => resolve(true);
      setTimeout(() => resolve(false), probeTimeoutMs);
    });
    firstConnection.onicecandidate = (candidateEvent) => {
      if (candidateEvent.candidate) void secondConnection.addIceCandidate(candidateEvent.candidate);
    };
    secondConnection.onicecandidate = (candidateEvent) => {
      if (candidateEvent.candidate) void firstConnection.addIceCandidate(candidateEvent.candidate);
    };
    secondConnection.ondatachannel = (channelEvent) => {
      channelEvent.channel.onopen = () => channelEvent.channel.send("probe");
    };
    await firstConnection.setLocalDescription(await firstConnection.createOffer());
    await secondConnection.setRemoteDescription(firstConnection.localDescription!);
    await secondConnection.setLocalDescription(await secondConnection.createAnswer());
    await firstConnection.setRemoteDescription(secondConnection.localDescription!);
    const opened = await channelOpened;
    firstConnection.close();
    secondConnection.close();
    return opened;
  }, loopbackProbeTimeoutMilliseconds);
}

async function launchBrowserConnection(): Promise<Browser> {
  if (chromeEndpoint !== undefined) return chromium.connectOverCDP(chromeEndpoint);
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return chromium.launch();
  }
}

async function recordRemoteControlClip() {
  const browserConnection = await launchBrowserConnection();
  try {
    const deckContext = await browserConnection.newContext({ viewport: deckViewportSize });
    const deckPage = await deckContext.newPage();
    await deckPage.goto(`${serverAddress}/?remote-broker=localhost:${brokerServerPort}#1`);
    await deckPage.waitForTimeout(settlePauseMilliseconds);
    if (!(await probeWebRtcLoopback(deckPage))) {
      throw new Error("WebRTC между двумя вкладками этой машины недоступен — клип пульта записывается на CI");
    }
    const deckWaitingSegment = await captureScreencast(deckPage, false, async () => {
      await deckPage.waitForTimeout(panelLeadMilliseconds);
      // The panel hides after two idle seconds and the slide starts intercepting clicks: wake it with the mouse.
      await deckPage.mouse.move(deckViewportSize.width / 2, 16);
      await deckPage.waitForTimeout(panelWakeMilliseconds);
      await deckPage.getByRole("button", { name: remotePanelButtonLabel }).click();
      await deckPage.waitForTimeout(panelTailMilliseconds);
    });
    const hostingCode = await deckPage.locator(hostingCodeSelector).inputValue();
    const phoneContext = await browserConnection.newContext({ viewport: phoneViewportSize });
    const phonePage = await phoneContext.newPage();
    const phoneDrivingSegment = await captureScreencast(phonePage, true, async () => {
      await phonePage.goto(`${serverAddress}/?remote&remote-broker=localhost:${brokerServerPort}#${hostingCode}`);
      await phonePage
        .locator(remotePositionSelector)
        .filter({ hasText: firstSlidePositionText })
        .waitFor({ timeout: phoneConnectedTimeoutMilliseconds });
      await phonePage.waitForTimeout(phoneConnectedPauseMilliseconds);
      await phonePage.locator(moveForwardSelector).click();
      await phonePage.waitForTimeout(betweenTapsPauseMilliseconds);
    });
    await phonePage.locator(moveForwardSelector).click();
    const deckReactingSegment = await captureScreencast(deckPage, false, async () => {
      await deckPage.waitForTimeout(deckTailMilliseconds);
    });
    await phoneContext.close();
    await deckContext.close();
    if (deckWaitingSegment.capturedFrames.length === 0 || phoneDrivingSegment.capturedFrames.length === 0 || deckReactingSegment.capturedFrames.length === 0) {
      throw new Error("Скринкаст не захватил ни одного кадра — клип не записан");
    }
    await encodeSegments([deckWaitingSegment, phoneDrivingSegment, deckReactingSegment]);
  } finally {
    await browserConnection.close();
  }
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
const brokerServer = spawn(path.join(workspaceFolder, "node_modules", ".bin", "peerjs"), ["--port", String(brokerServerPort), "--path", "/"], { stdio: "ignore" });
try {
  await waitForServer(serverAddress);
  await waitForServer(`http://localhost:${brokerServerPort}`);
  await recordRemoteControlClip();
} finally {
  brokerServer.kill();
  developmentServer.kill();
}
