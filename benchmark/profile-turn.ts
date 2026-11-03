// node benchmark/profile-turn.ts <site folder> [turns]
// Serves a built talk and instruments the page: time from keydown to startViewTransition,
// duration of the VT update callback (the React commit), layout reads, and frame timing.
import { chromium } from "playwright-core";
import { serveFolder } from "./benchmark-measurements.ts";

const siteFolder = process.argv[2];
if (siteFolder === undefined) throw new Error("Usage: node benchmark/profile-turn.ts <site folder> [turns]");
const turnCount = Number(process.argv[3] ?? 3);

type TurnProfileData = {
  keydownAt: number;
  transitionStartAt: number;
  updateCallbackMs: number;
  rectReads: number;
  styleReads: number;
  layoutReads: number;
  layoutReadMs: number;
  firstPaintAfterUpdateAt: number;
};

const emptyTurnProfile: TurnProfileData = {
  keydownAt: 0,
  transitionStartAt: 0,
  updateCallbackMs: 0,
  rectReads: 0,
  styleReads: 0,
  layoutReads: 0,
  layoutReadMs: 0,
  firstPaintAfterUpdateAt: 0,
};

const siteServer = await serveFolder(siteFolder);
const { port: sitePort } = siteServer.address() as { port: number };
const chromeBrowser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch({}));
try {
  const browserContext = await chromeBrowser.newContext({ viewport: { width: 1280, height: 720 } });
  const measuredPage = await browserContext.newPage();
  await measuredPage.goto(`http://127.0.0.1:${sitePort}/`, { waitUntil: "commit" });
  await measuredPage.getByText("Slidemachina benchmark").first().waitFor({ state: "visible", timeout: 120_000 });
  await measuredPage.locator("[data-static-cover]").waitFor({ state: "detached", timeout: 10_000 }).catch(() => undefined);
  await measuredPage.waitForLoadState("networkidle").catch(() => undefined);
  await measuredPage.waitForTimeout(1000);

  await measuredPage.evaluate((initialProfile) => {
    const observedWindow = window as unknown as { turnProfile: typeof initialProfile };
    observedWindow.turnProfile = { ...initialProfile };
    window.addEventListener(
      "keydown",
      (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== "ArrowRight" || observedWindow.turnProfile.keydownAt > 0) return;
        observedWindow.turnProfile.keydownAt = performance.now();
      },
      true,
    );
    const originalStartViewTransition = document.startViewTransition.bind(document);
    document.startViewTransition = ((updateCallback: () => void) => {
      observedWindow.turnProfile.transitionStartAt = performance.now();
      const wrappedCallback = () => {
        const callbackStart = performance.now();
        updateCallback();
        observedWindow.turnProfile.updateCallbackMs = performance.now() - callbackStart;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            observedWindow.turnProfile.firstPaintAfterUpdateAt = performance.now();
          });
        });
      };
      return originalStartViewTransition(wrappedCallback);
    }) as typeof document.startViewTransition;
    // oxlint-disable-next-line typescript/unbound-method -- the prototype is called with an explicit this
    const rectPrototype = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect(this: Element) {
      observedWindow.turnProfile.rectReads += 1;
      return rectPrototype.call(this);
    };
    const stylePrototype = CSSStyleDeclaration.prototype;
    // oxlint-disable-next-line typescript/unbound-method -- the prototype is called with an explicit this
    const originalGetPropertyValue = stylePrototype.getPropertyValue;
    stylePrototype.getPropertyValue = function patchedGetPropertyValue(this: CSSStyleDeclaration, propertyName: string) {
      observedWindow.turnProfile.styleReads += 1;
      return originalGetPropertyValue.call(this, propertyName);
    };
    const layoutProperties = ["offsetWidth", "offsetHeight", "offsetTop", "scrollWidth", "clientWidth", "clientHeight"] as const;
    for (const layoutProperty of layoutProperties) {
      let propertyOwner = HTMLElement.prototype;
      while (!Object.prototype.hasOwnProperty.call(propertyOwner, layoutProperty)) {
        propertyOwner = Object.getPrototypeOf(propertyOwner) as HTMLElement;
      }
      // oxlint-disable-next-line typescript/unbound-method -- the getter is called with an explicit this
      const originalGetter = Object.getOwnPropertyDescriptor(propertyOwner, layoutProperty)!.get as (this: HTMLElement) => number;
      Object.defineProperty(HTMLElement.prototype, layoutProperty, {
        configurable: true,
        get(this: HTMLElement): number {
          const readStart = performance.now();
          const propertyValue = originalGetter.call(this);
          observedWindow.turnProfile.layoutReads += 1;
          observedWindow.turnProfile.layoutReadMs += performance.now() - readStart;
          return propertyValue;
        },
      });
    }
  }, emptyTurnProfile);

  for (let turnIndex = 0; turnIndex < turnCount; turnIndex += 1) {
    await measuredPage.evaluate((resetProfile) => {
      const observedWindow = window as unknown as { turnProfile: typeof resetProfile };
      observedWindow.turnProfile = { ...resetProfile };
    }, emptyTurnProfile);
    await measuredPage.keyboard.press("Home");
    await measuredPage.waitForTimeout(400);
    await measuredPage.keyboard.press("ArrowRight");
    await measuredPage.waitForTimeout(1200);
    const turnProfile = await measuredPage.evaluate(() => (window as unknown as { turnProfile: TurnProfileData }).turnProfile);
    const keydownAt = turnProfile.keydownAt;
    const toTransition = turnProfile.transitionStartAt - keydownAt;
    const updateMs = turnProfile.updateCallbackMs;
    const firstPaintAfter = turnProfile.firstPaintAfterUpdateAt > 0 ? turnProfile.firstPaintAfterUpdateAt - keydownAt : NaN;
    console.log(
      `turn ${turnIndex}: keydown→startViewTransition ${toTransition.toFixed(1)} ms; VT update callback ${updateMs.toFixed(1)} ms; ` +
        `keydown→first paint after update ${firstPaintAfter.toFixed(1)} ms; rect reads ${turnProfile.rectReads}; ` +
        `style reads ${turnProfile.styleReads}; layout reads ${turnProfile.layoutReads} (${turnProfile.layoutReadMs.toFixed(1)} ms)`,
    );
  }
} finally {
  await chromeBrowser.close();
  siteServer.close();
}
