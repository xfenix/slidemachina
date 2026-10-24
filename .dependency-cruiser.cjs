// Engine layout rules from docs/slidemachina.md, checked by `npm run check`.
const browserRuntimeFolder = "^packages/slidemachina/browser-runtime/";
const serverRuntimeFolder = "^packages/slidemachina/server-runtime/";
const sharedRuntimeFolder = "^packages/slidemachina/shared-between-runtimes/";

module.exports = {
  forbidden: [
    {
      name: "browser-without-server",
      comment: "Браузерный код не берёт серверный.",
      severity: "error",
      from: { path: browserRuntimeFolder },
      to: { path: serverRuntimeFolder },
    },
    {
      name: "browser-without-node",
      comment: "Браузерный код не берёт модули Node.",
      severity: "error",
      from: { path: browserRuntimeFolder },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "server-without-browser",
      comment: "Серверный код не берёт браузерные модули.",
      severity: "error",
      from: { path: serverRuntimeFolder },
      to: { path: browserRuntimeFolder },
    },
    {
      name: "shared-without-dependencies",
      comment: "Общий код не зависит ни от остального движка, ни от пакетов.",
      severity: "error",
      from: { path: sharedRuntimeFolder },
      to: { pathNot: sharedRuntimeFolder },
    },
    {
      name: "core-without-blocks",
      comment: "Ядро не зависит от блоков.",
      severity: "error",
      from: { path: `${browserRuntimeFolder}presentation-core/` },
      to: { path: `${browserRuntimeFolder}[^/]+-blocks/` },
    },
    {
      name: "blocks-independent",
      comment: "Блоки не зависят друг от друга.",
      severity: "error",
      from: { path: `${browserRuntimeFolder}([^/]+-blocks)/` },
      to: { path: `${browserRuntimeFolder}[^/]+-blocks/`, pathNot: `${browserRuntimeFolder}$1/` },
    },
    {
      name: "no-circular",
      comment: "Модули не импортируют друг друга по кругу.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment: "Модуль, который никто не импортирует и который сам ничего не берёт, лишний.",
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
