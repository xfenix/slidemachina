import { readMorphTiming } from "./morph-timing.ts";

const pathMorphSelector = "path[data-morph-path]";
const pathLayerStyleProperties = ["fill", "fillOpacity", "stroke", "strokeWidth", "strokeLinejoin", "strokeLinecap", "opacity"] as const;

// The exporter looks for this global; the engine registers contour animations there so a seek can drive them.
type MotionCaptureProbe = {
  isEnabled: boolean;
  isReady: boolean;
  capturedAnimations: Animation[];
  durationMilliseconds: number;
  animationNames: string[];
};

export type PathMorphPair = {
  outgoingPath: SVGPathElement;
  incomingPath: SVGPathElement;
};

type ParsedPath = {
  commandSignature: string;
  numbers: number[];
};

type ActivePathMorph = {
  overlayElement: SVGSVGElement;
  pathAnimations: Animation[];
  hiddenPaths: SVGPathElement[];
};

let activePathMorph: ActivePathMorph | undefined;

// Only absolute M / L / Z commands with the same structure interpolate; anything else keeps the snapshot fallback.
export function parseCompatiblePath(pathData: string): ParsedPath | undefined {
  const commandPattern = /([MLZ])\s*((?:-?\d*\.?\d+(?:\s+|,)?)*)/g;
  const commandSignature: string[] = [];
  const numbers: number[] = [];
  let matchedLength = 0;
  for (const commandMatch of pathData.matchAll(commandPattern)) {
    const [, commandLetter, coordinateText] = commandMatch;
    if (commandLetter !== "M" && commandLetter !== "L" && commandLetter !== "Z") return undefined;
    const coordinateNumbers = (coordinateText ?? "").trim() === "" ? [] : (coordinateText ?? "").trim().split(/[\s,]+/).map(Number);
    if (coordinateNumbers.some((coordinateNumber) => !Number.isFinite(coordinateNumber))) return undefined;
    const hasExpectedCoordinates = commandLetter === "Z" ? coordinateNumbers.length === 0 : coordinateNumbers.length % 2 === 0;
    if (!hasExpectedCoordinates) return undefined;
    commandSignature.push(`${commandLetter}:${coordinateNumbers.length}`);
    numbers.push(...coordinateNumbers);
    matchedLength += commandMatch[0].length;
  }
  if (commandSignature.length === 0 || matchedLength < pathData.replace(/\s+/g, " ").trim().length) return undefined;
  return { commandSignature: commandSignature.join("|"), numbers };
}

function formatPathNumbers(parsedPath: ParsedPath, interpolatedNumbers: number[]): string {
  let numberPosition = 0;
  return parsedPath.commandSignature
    .split("|")
    .map((commandDescription) => {
      const [commandLetter, coordinateCountText] = commandDescription.split(":");
      const coordinateCount = Number(coordinateCountText);
      if (coordinateCount === 0) return commandLetter;
      const commandNumbers = interpolatedNumbers.slice(numberPosition, numberPosition + coordinateCount);
      numberPosition += coordinateCount;
      return `${commandLetter}${commandNumbers.map((commandNumber) => Math.round(commandNumber * 100) / 100).join(" ")}`;
    })
    .join(" ");
}

// Maps path user coordinates to page pixels through the host svg's viewBox, so two states interpolate in one space.
function describeScreenPath(pathElement: SVGPathElement): { screenPath: ParsedPath; paintStyle: Partial<CSSStyleDeclaration> } | undefined {
  const hostSvg = pathElement.ownerSVGElement;
  if (hostSvg === null) return undefined;
  const svgRectangle = hostSvg.getBoundingClientRect();
  const viewBox = hostSvg.viewBox.baseVal;
  if (viewBox.width === 0 || viewBox.height === 0 || svgRectangle.width === 0 || svgRectangle.height === 0) return undefined;
  const parsedPath = parseCompatiblePath(pathElement.getAttribute("d") ?? "");
  if (parsedPath === undefined) return undefined;
  const scaleX = svgRectangle.width / viewBox.width;
  const scaleY = svgRectangle.height / viewBox.height;
  const screenNumbers = parsedPath.numbers.map((pathNumber, numberIndex) =>
    numberIndex % 2 === 0 ? svgRectangle.left + (pathNumber - viewBox.x) * scaleX : svgRectangle.top + (pathNumber - viewBox.y) * scaleY,
  );
  const pathStyle = getComputedStyle(pathElement);
  const paintStyle: Partial<CSSStyleDeclaration> = {};
  for (const styleProperty of pathLayerStyleProperties) paintStyle[styleProperty] = pathStyle[styleProperty];
  return { screenPath: { commandSignature: parsedPath.commandSignature, numbers: screenNumbers }, paintStyle };
}

// Pairs carry occurrence numbers like morph names: two paths named "outline" on one slide pair in document order.
export function findPathMorphPairs(outgoingSlide: HTMLElement, incomingSlide: HTMLElement): PathMorphPair[] {
  const collectNamedPaths = (slideElement: HTMLElement) => {
    const pathsByName = new Map<string, SVGPathElement[]>();
    for (const pathElement of slideElement.querySelectorAll<SVGPathElement>(pathMorphSelector)) {
      const pathName = pathElement.dataset.morphPath!;
      pathsByName.set(pathName, [...(pathsByName.get(pathName) ?? []), pathElement]);
    }
    return pathsByName;
  };
  const outgoingPaths = collectNamedPaths(outgoingSlide);
  const incomingPaths = collectNamedPaths(incomingSlide);
  const pathPairs: PathMorphPair[] = [];
  for (const [pathName, outgoingNamedPaths] of outgoingPaths) {
    const incomingNamedPaths = incomingPaths.get(pathName) ?? [];
    outgoingNamedPaths.forEach((outgoingPath, pathPosition) => {
      const incomingPath = incomingNamedPaths[pathPosition];
      if (incomingPath === undefined) return;
      const outgoingData = parseCompatiblePath(outgoingPath.getAttribute("d") ?? "");
      const incomingData = parseCompatiblePath(incomingPath.getAttribute("d") ?? "");
      if (outgoingData === undefined || incomingData === undefined || outgoingData.commandSignature !== incomingData.commandSignature) return;
      pathPairs.push({ outgoingPath, incomingPath });
    });
  }
  return pathPairs;
}

function finishPathMorph(finishedMorph: ActivePathMorph) {
  finishedMorph.overlayElement.remove();
  for (const hiddenPath of finishedMorph.hiddenPaths) {
    if (hiddenPath.isConnected) hiddenPath.style.removeProperty("visibility");
  }
  if (activePathMorph === finishedMorph) activePathMorph = undefined;
}

function cancelActivePathMorph() {
  const canceledMorph = activePathMorph;
  if (canceledMorph === undefined) return;
  activePathMorph = undefined;
  for (const pathAnimation of canceledMorph.pathAnimations) pathAnimation.cancel();
  finishPathMorph(canceledMorph);
}

// The contour interpolates on a live overlay instead of two snapshots: a view transition paints no live elements,
// so endpoint paths hide for the transition's length and the overlay draws every intermediate vertex.
export function runPathMorphTransition(updateSlides: () => void, pathPairs: PathMorphPair[]) {
  cancelActivePathMorph();
  const pairScreens = pathPairs.map((pathPair) => ({
    outgoingScreen: describeScreenPath(pathPair.outgoingPath),
    incomingScreen: describeScreenPath(pathPair.incomingPath),
  }));
  if (pairScreens.some((pairScreen) => pairScreen.outgoingScreen === undefined || pairScreen.incomingScreen === undefined)) {
    updateSlides();
    return;
  }
  for (const pathPair of pathPairs) {
    pathPair.outgoingPath.style.visibility = "hidden";
    pathPair.incomingPath.style.visibility = "hidden";
  }
  const overlayElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  overlayElement.setAttribute("width", String(document.documentElement.clientWidth));
  overlayElement.setAttribute("height", String(document.documentElement.clientHeight));
  overlayElement.setAttribute("data--slidemachina-morph-path-overlay", "");
  overlayElement.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  const { durationMilliseconds, easing } = readMorphTiming();
  const pathAnimations = pairScreens.map(({ outgoingScreen, incomingScreen }) => {
    const outlinePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    Object.assign(outlinePath.style, incomingScreen!.paintStyle);
    overlayElement.append(outlinePath);
    return outlinePath.animate(
      [
        { d: `path("${formatPathNumbers(outgoingScreen!.screenPath, outgoingScreen!.screenPath.numbers)}")` },
        { d: `path("${formatPathNumbers(incomingScreen!.screenPath, incomingScreen!.screenPath.numbers)}")` },
      ],
      { duration: durationMilliseconds, easing, fill: "both" },
    );
  });
  const startedMorph: ActivePathMorph = { overlayElement, pathAnimations, hiddenPaths: pathPairs.flatMap((pathPair) => [pathPair.outgoingPath, pathPair.incomingPath]) };
  activePathMorph = startedMorph;
  updateSlides();
  document.body.append(overlayElement);
  const motionCapture = (window as unknown as { __slidemachinaMotionCapture?: MotionCaptureProbe }).__slidemachinaMotionCapture;
  if (motionCapture?.isEnabled) {
    motionCapture.capturedAnimations = pathAnimations;
    motionCapture.durationMilliseconds = durationMilliseconds;
    motionCapture.animationNames = pathAnimations.map(() => "path-morph");
    motionCapture.isReady = true;
  }
  // Only the morph that is still active cleans up: a newer transition owns the overlay by the time an older one settles.
  void Promise.allSettled(pathAnimations.map((pathAnimation) => pathAnimation.finished)).then(() => finishPathMorph(startedMorph));
}
