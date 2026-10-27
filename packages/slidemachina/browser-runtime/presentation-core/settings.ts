// Engine-wide browser settings: timings, limits and sizes that more than one module uses or that a presentation may want to tune.
// Settings of a single module stay at the top of that module; values shared with server-runtime live in shared-between-runtimes/engine-constants.js.

// Heavy parts (diagrams, scenes) start in the background once the first screen has settled.
export const backgroundLoadingPause = 5000;
export const idleCallbackTimeout = 2000;

// The toolbar hides after this pause without pointer movement.
export const toolbarIdleDelay = 2000;

// Typed slide numbers are applied after this pause without a new digit.
export const typingPauseLimit = 3000;

// A horizontal touch moves a slide only after this distance.
export const shortestSwipeDistance = 50;
// A touch shorter and closer than this is a tap: it moves forward, or back on the left third.
export const longestTapDistance = 12;
export const longestTapDuration = 300;

// The print view keeps this margin around a page.
export const printViewMargin = 48;

// Printing waits for every diagram and scene this long, polling at this interval.
export const readinessTimeout = 20000;
export const readinessCheckInterval = 50;
