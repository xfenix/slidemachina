import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

// Fragments are see-through, so parts can come from a helper that returns <>…</>.
export function listMarkupElements(markupChildren: ReactNode): ReactElement[] {
  return Children.toArray(markupChildren)
    .filter(isValidElement)
    .flatMap((markupElement) =>
      markupElement.type === Fragment
        ? listMarkupElements((markupElement.props as { children?: ReactNode }).children)
        : [markupElement],
    );
}
