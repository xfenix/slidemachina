// Engine layout rules from docs/slidemachina.md, checked by `npm run check`.
const browserRuntimeFolder = "^packages/slidemachina/browser-runtime/";
const serverRuntimeFolder = "^packages/slidemachina/server-runtime/";
const sharedRuntimeFolder = "^packages/slidemachina/shared-between-runtimes/";

module.exports = {
  forbidden: [
    {
      name: "browser-without-server",
      comment: "Browser code does not import server code.",
      severity: "error",
      from: { path: browserRuntimeFolder },
      to: { path: serverRuntimeFolder },
    },
    {
      name: "browser-without-node",
      comment: "Browser code does not import Node modules.",
      severity: "error",
      from: { path: browserRuntimeFolder },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "server-without-browser",
      comment: "Server code does not import browser code.",
      severity: "error",
      from: { path: serverRuntimeFolder },
      to: { path: browserRuntimeFolder },
    },
    {
      name: "shared-without-dependencies",
      comment: "Shared code imports only other shared code: no engine modules, no packages.",
      severity: "error",
      from: { path: sharedRuntimeFolder },
      to: { pathNot: sharedRuntimeFolder },
    },
    {
      name: "core-without-blocks",
      comment: "The core does not import blocks.",
      severity: "error",
      from: { path: `${browserRuntimeFolder}presentation-core/` },
      to: { path: `${browserRuntimeFolder}[^/]+-blocks/` },
    },
    {
      name: "blocks-independent",
      comment: "Blocks do not import each other.",
      severity: "error",
      from: { path: `${browserRuntimeFolder}([^/]+-blocks)/` },
      to: { path: `${browserRuntimeFolder}[^/]+-blocks/`, pathNot: `${browserRuntimeFolder}$1/` },
    },
    {
      name: "no-circular",
      comment: "No import cycles.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment: "A module that imports nothing and that nobody imports is unused: delete it.",
      severity: "error",
      from: { orphan: true },
      to: {},
    },
  ],
  options: {
    // dependency-cruiser does not read TypeScript 7 yet, swc parses the sources instead.
    parser: "swc",
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
  },
};
