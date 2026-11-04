import path from "node:path";
import { build } from "vite";
import { commandLineTexts } from "./command-line-texts.ts";
import { createRemotePageBuildConfiguration } from "../development-server/vite-configuration.ts";

// One HTML file with the remote control page inside: put it on any static address and the phone opens it to join a talk.
export async function runRemotePageCommand(outFileArgument: string) {
  const remoteHtmlPath = path.resolve(outFileArgument);
  await build(createRemotePageBuildConfiguration(remoteHtmlPath));
  console.log(commandLineTexts.remotePageBuilt(path.relative(process.cwd(), remoteHtmlPath)));
}
