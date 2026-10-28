import { useEffect } from "react";
import { engineFaviconAttribute } from "../../shared-between-runtimes/engine-constants.ts";

// The page comes with the slidemachina mark; a presentation with its own favicon takes its place.
export function useCustomFavicon(faviconAddress: string | undefined): void {
  useEffect(() => {
    if (faviconAddress === undefined) return;
    const engineFavicons = [...document.head.querySelectorAll(`link[${engineFaviconAttribute}]`)];
    const customFavicon = Object.assign(document.createElement("link"), { rel: "icon", href: faviconAddress });
    for (const engineFavicon of engineFavicons) engineFavicon.remove();
    document.head.append(customFavicon);
    return () => {
      customFavicon.remove();
      document.head.append(...engineFavicons);
    };
  }, [faviconAddress]);
}
