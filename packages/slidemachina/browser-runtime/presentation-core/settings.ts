// Engine-wide browser settings: timings, limits and sizes that more than one module uses or that a presentation may want to tune.
// Settings of a single module stay at the top of that module; values shared with node-tooling live in shared-between-runtimes/engine-constants.js.

// The slide canvas: height is fixed, width follows the screen within these aspect ratios.
export const canvasHeight = 1080;
export const narrowestAspectRatio = 4 / 3;
export const widestAspectRatio = 21 / 9;

// Heavy parts (diagrams, scenes) start in the background once the first screen has settled.
export const backgroundLoadingPause = 5000;
export const idleCallbackTimeout = 2000;

// The toolbar hides after this pause without pointer movement.
export const toolbarIdleDelay = 2000;

// Typed slide numbers are applied after this pause without a new digit.
export const typingPauseLimit = 3000;

// A horizontal touch moves a slide only after this distance.
export const shortestSwipeDistance = 50;

// One printed page fills this width; the print view keeps this margin around it.
export const printedPageWidth = 1920;
export const printViewMargin = 48;

// Printing waits for every diagram and scene this long, polling at this interval.
export const readinessTimeout = 20000;
export const readinessCheckInterval = 50;
