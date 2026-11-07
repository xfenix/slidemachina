// node benchmark/quick-turns.ts <site folder> [more folders...] [-- repeats]
// Serves one or more built sites and measures slide-change turns in a single browser:
// variants share one Chrome rasterization fate, so the comparison is between sites, not launches.
import { chromium } from "playwright-core";
import { measureSlideChangeTurns, serveFolder } from "./benchmark-measurements.ts";

const repeatFlagIndex = process.argv.indexOf("--");
const repeatCount = repeatFlagIndex === -1 ? 7 : Number(process.argv[repeatFlagIndex + 1]);
const siteFolders = process.argv.slice(2).filter((argument, argumentIndex) => (repeatFlagIndex === -1 || argumentIndex + 2 < repeatFlagIndex) && !argument.startsWith("--"));
if (siteFolders.length === 0) throw new Error("Usage: node benchmark/quick-turns.ts <site folder> [more folders...] [-- repeats]");

const servers = await Promise.all(siteFolders.map(serveFolder));
const chromeBrowser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch({}));
try {
  for (const [siteIndex, siteFolder] of siteFolders.entries()) {
    const { port: sitePort } = servers[siteIndex]!.address() as { port: number };
    const slideChangeMilliseconds = await measureSlideChangeTurns(chromeBrowser, `http://127.0.0.1:${sitePort}/`, repeatCount);
    console.log(`${siteFolder}: ${slideChangeMilliseconds.toFixed(0)} ms (median of ${repeatCount})`);
  }
} finally {
  await chromeBrowser.close();
  for (const siteServer of servers) siteServer.close();
}
