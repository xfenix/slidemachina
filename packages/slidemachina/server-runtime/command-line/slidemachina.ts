#!/usr/bin/env node
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createServer } from "vite";
import { commandLineTexts } from "./command-line-texts.ts";
import { describeSite } from "../presentation-repository/presentation-repository.ts";
import { createViteConfiguration } from "../development-server/vite-configuration.ts";

const largestPortNumber = 65536;

function stopWithProblem(problemText: string): never {
  console.error(`${problemText}\n\n${commandLineTexts.usage}`);
  process.exit(1);
}

function readCommandLine() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        port: { type: "string" },
        html: { type: "boolean" },
        protected: { type: "boolean" },
        folder: { type: "boolean" },
        zip: { type: "boolean" },
        pdf: { type: "boolean" },
        steps: { type: "boolean" },
        out: { type: "string" },
      },
    });
  } catch (parseError) {
    // Node quotes the flag: "Unknown option '--pfd'", "Option '--out <value>' argument missing".
    const parseProblem = parseError as NodeJS.ErrnoException;
    const [, quotedFlag = ""] = /'(--?[\w-]+)/.exec(parseProblem.message) ?? [];
    return stopWithProblem(parseProblem.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" ? commandLineTexts.unknownFlag(quotedFlag) : commandLineTexts.wrongFlag(quotedFlag));
  }
}

const parsedCommandLine = readCommandLine();
const [commandName, projectFolderArgument = "."] = parsedCommandLine.positionals;

if (commandName !== "dev" && commandName !== "build") {
  console.log(commandLineTexts.usage);
  process.exit(commandName === undefined ? 0 : 1);
}

const portText = parsedCommandLine.values.port;
const portNumber = portText === undefined ? undefined : Number(portText);
if (portNumber !== undefined && !(Number.isInteger(portNumber) && portNumber > 0 && portNumber < largestPortNumber)) {
  stopWithProblem(commandLineTexts.wrongPort(String(portText)));
}

// Vite reports real file paths: with a link in the path (macOS /tmp) a resolved folder would never match them.
const requestedFolder = path.resolve(projectFolderArgument);
const siteLayout = existsSync(requestedFolder) ? describeSite(realpathSync(requestedFolder)) : undefined;
if (siteLayout === undefined) {
  console.error(commandLineTexts.missingPresentationFile(requestedFolder));
  process.exit(1);
}

if (commandName === "build") {
  // The build pulls in sharp, staticrypt and Playwright only when it runs.
  const { runBuildCommand } = await import("./build-command.ts");
  try {
    await runBuildCommand(siteLayout, parsedCommandLine.values);
  } catch (buildError) {
    const { log } = await import("@clack/prompts");
    log.error(buildError instanceof Error ? buildError.message : String(buildError));
    process.exit(1);
  }
} else {
  const developmentServer = await createServer(createViteConfiguration(siteLayout, { port: portNumber, open: process.stdout.isTTY }));
  await developmentServer.listen();
  developmentServer.printUrls();
}
