import { cpSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";
import { commandLineScript, demoFolderName, examplesFolder, skipsGeneratedFiles } from "./tests/test-helpers.ts";

const testServerPort = 5199;
// Every dev server of the tests, the ones the tests start too, runs without Agentation: its notes server is not there.
process.env.SLIDEMACHINA_AGENTATION = "off";

// The core test edits slide files, so it gets a copy of the demo; workers inherit the folder instead of copying again.
if (process.env.SLIDEMACHINA_TEST_DEMO_COPY === undefined) {
  const examplesCopyFolder = path.join(mkdtempSync(path.join(os.tmpdir(), "slidemachina-test-demo-")), "examples");
  cpSync(examplesFolder, examplesCopyFolder, { recursive: true, filter: skipsGeneratedFiles });
  process.env.SLIDEMACHINA_TEST_DEMO_COPY = path.join(examplesCopyFolder, demoFolderName);
  process.on("exit", () => rmSync(path.dirname(examplesCopyFolder), { recursive: true, force: true }));
}

export default defineConfig({
  testDir: "tests",
  // The build test runs Vite and Chrome at full load; next to it the transition checks lose frames.
  workers: 1,
  use: {
    channel: "chrome",
    // The suite reads the Russian interface texts; the browser locale must not depend on the machine it runs on.
    locale: "ru-RU",
    baseURL: `http://localhost:${testServerPort}`,
    launchOptions: {
      // Two same-machine tabs connect over plain host candidates in the remote control test:
      // without this flag Chrome masks local IPs behind mDNS names that this network does not resolve.
      args: ["--disable-features=WebRtcHideLocalIpsWithMdns", "--enable-features=WebRtcAllowLoopbackNetwork"],
    },
  },
  webServer: [
    {
      command: `node ${JSON.stringify(commandLineScript)} dev ${JSON.stringify(process.env.SLIDEMACHINA_TEST_DEMO_COPY)} --port ${testServerPort}`,
      url: `http://localhost:${testServerPort}`,
      reuseExistingServer: false,
    },
    // The remote control test drives a real WebRTC connection: both pages talk to this local PeerJS broker
    // through ?remote-broker=localhost:9300, so the suite stays deterministic and offline-friendly.
    {
      command: "node_modules/.bin/peerjs --port 9300 --path /",
      url: "http://localhost:9300",
      reuseExistingServer: false,
    },
  ],
});
