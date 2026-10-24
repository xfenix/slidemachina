// The card cover and the slide canvas share a view transition name, so a presentation grows out of its card.
const sharedLayerName = "presentation-cover";

function toPagePath(pageAddress: string | undefined | null) {
  return pageAddress == null ? undefined : new URL(pageAddress, location.href).pathname.replace(/index\.html$/, "");
}

function nameTransitionElement(namedElement: HTMLElement | null | undefined, viewTransition: ViewTransition | null) {
  if (namedElement == null || viewTransition === null) return;
  namedElement.style.viewTransitionName = sharedLayerName;
  const removeName = () => namedElement.style.removeProperty("view-transition-name");
  // A transition the other page skipped rejects instead of finishing.
  viewTransition.finished.then(removeName, removeName);
}

// A page restored from the back-forward cache still carries the name from its departure: the next slide transition must not.
function connectSharedLayer(findNamedElement: (otherPagePath: string | undefined) => HTMLElement | null | undefined) {
  addEventListener("pageswap", (swapEvent) => {
    nameTransitionElement(findNamedElement(toPagePath(swapEvent.activation?.entry.url)), swapEvent.viewTransition);
  });
  addEventListener("pagereveal", (revealEvent) => {
    document.querySelector<HTMLElement>(`[style*="${sharedLayerName}"]`)?.style.removeProperty("view-transition-name");
    nameTransitionElement(findNamedElement(toPagePath(navigation.activation?.from?.url)), revealEvent.viewTransition);
  });
}

export function connectCanvasToList(presentationListAddress: string) {
  const listPagePath = toPagePath(presentationListAddress);
  connectSharedLayer((otherPagePath) => (otherPagePath === listPagePath ? document.querySelector<HTMLElement>("[data-canvas]") : undefined));
}

export function connectCoversToPresentations() {
  connectSharedLayer((otherPagePath) =>
    [...document.querySelectorAll<HTMLAnchorElement>("[data-list-link]")]
      .find((cardLink) => toPagePath(cardLink.href) === otherPagePath)
      ?.querySelector<HTMLElement>("[data-list-cover]"),
  );
}
