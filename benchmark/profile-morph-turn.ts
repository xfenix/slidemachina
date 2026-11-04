// node benchmark/profile-morph-turn.ts <url> [turns]
// Instruments a morph-heavy turn: jump to the slide before "Морфинг кода", measure forward and backward turns.
import { chromium } from "playwright-core";

const pageAddress = process.argv[2];
if (pageAddress === undefined) throw new Error("Usage: node benchmark/profile-morph-turn.ts <url> [turns]");
const turnCount = Number(process.argv[3] ?? 2);

type TurnProfileData = {
  keydownAt: number;
  transitionStartAt: number;
  updateCallbackMs: number;
  rectReads: number;
  styleReads: number;
  layoutReads: number;
  layoutReadMs: number;
};

const emptyTurnProfile: TurnProfileData = {
  keydownAt: 0,
  transitionStartAt: 0,
  updateCallbackMs: 0,
  rectReads: 0,
  styleReads: 0,
  layoutReads: 0,
  layoutReadMs: 0,
};

const chromeBrowser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch({}));
try {
  const browserContext = await chromeBrowser.newContext({ viewport: { width: 1280, height: 720 } });
  const measuredPage = await browserContext.newPage();
  await measuredPage.goto(pageAddress, { waitUntil: "commit" });
  await measuredPage.locator("[data-static-cover]").waitFor({ state: "detached", timeout: 30_000 }).catch(() => undefined);
  await measuredPage.waitForLoadState("networkidle").catch(() => undefined);
  // Distant slides render as placeholders, so walk the hash until the morph slide is current.
  let morphSlideAddress = 0;
  for (let candidateAddress = 2; candidateAddress < 60; candidateAddress += 1) {
    await measuredPage.evaluate((address) => {
      location.hash = `#${address}`;
    }, candidateAddress);
    await measuredPage.waitForTimeout(150);
    const isMorphSlide = await measuredPage.locator("[data-canvas] > [data-current]").evaluate(
      (currentSlide) => [...currentSlide.querySelectorAll("h2")].some((heading) => heading.textContent.replace(/\s+/g, " ").trim() === "Морфинг кода"),
    );
    if (isMorphSlide) {
      morphSlideAddress = candidateAddress;
      break;
    }
  }
  if (morphSlideAddress === 0) throw new Error("Morph slide not found");

  await measuredPage.evaluate((initialProfile) => {
    const observedWindow = window as unknown as { turnProfile: typeof initialProfile };
    observedWindow.turnProfile = { ...initialProfile };
    window.addEventListener(
      "keydown",
      (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== "PageDown" && keyEvent.key !== "PageUp") return;
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

  const reportTurn = async (label: string) => {
    await measuredPage.waitForTimeout(900);
    const turnProfile = await measuredPage.evaluate(() => (window as unknown as { turnProfile: TurnProfileData }).turnProfile);
    const keydownAt = turnProfile.keydownAt;
    console.log(
      `${label}: keydown→startViewTransition ${(turnProfile.transitionStartAt - keydownAt).toFixed(1)} ms; ` +
        `VT update callback ${turnProfile.updateCallbackMs.toFixed(1)} ms; rect reads ${turnProfile.rectReads}; ` +
        `style reads ${turnProfile.styleReads}; layout reads ${turnProfile.layoutReads} (${turnProfile.layoutReadMs.toFixed(1)} ms)`,
    );
    await measuredPage.evaluate((resetProfile) => {
      const observedWindow = window as unknown as { turnProfile: typeof resetProfile };
      observedWindow.turnProfile = { ...resetProfile };
    }, emptyTurnProfile);
  };

  for (let turnIndex = 0; turnIndex < turnCount; turnIndex += 1) {
    await measuredPage.keyboard.press("PageDown");
    await reportTurn(`forward ${turnIndex + 1}`);
    await measuredPage.keyboard.press("PageUp");
    await reportTurn(`backward ${turnIndex + 1}`);
  }
} finally {
  await chromeBrowser.close();
}
