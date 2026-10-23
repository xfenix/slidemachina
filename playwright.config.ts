import { cpSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const testServerPort = 5199;
// Every dev server of the tests, the ones the tests start too, runs without Agentation: its notes server is not there.
process.env.SLIDEMACHINA_AGENTATION = "off";

// The core test edits slide files, so it gets a copy of the demo; workers inherit the folder instead of copying again.
if (process.env.SLIDEMACHINA_TEST_DEMO_COPY === undefined) {
  const demoCopyFolder = path.join(mkdtempSync(path.join(os.tmpdir(), "slidemachina-test-demo-")), "demo-presentation");
  cpSync(path.resolve("demo-presentation"), demoCopyFolder, { recursive: true });
  process.env.SLIDEMACHINA_TEST_DEMO_COPY = demoCopyFolder;
  process.on("exit", () => rmSync(path.dirname(demoCopyFolder), { recursive: true, force: true }));
}

export default defineConfig({
  testDir: "tests",
  // The build test runs Vite and Chrome at full load; next to it the transition checks lose frames.
  workers: 1,
  use: {
    channel: "chrome",
    baseURL: `http://localhost:${testServerPort}`,
  },
  webServer: {
    command: `node bin/slidemachina.js dev ${JSON.stringify(process.env.SLIDEMACHINA_TEST_DEMO_COPY)} --port ${testServerPort}`,
    url: `http://localhost:${testServerPort}`,
    reuseExistingServer: false,
  },
});
