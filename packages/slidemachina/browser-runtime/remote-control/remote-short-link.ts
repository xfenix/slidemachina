import { useEffect, useState } from "react";

type LinkShortenerService = {
  serviceName: string;
  buildShortenFetchRequest: (longLink: string) => { fetchAddress: string; fetchInit: RequestInit };
  readShortenedLink: (responseBody: string) => string | undefined;
};

const linkShortenerServices: LinkShortenerService[] = [
  {
    serviceName: "da.gd",
    buildShortenFetchRequest: (longLink) => ({
      fetchAddress: `https://da.gd/shorten?url=${encodeURIComponent(longLink)}`,
      fetchInit: {},
    }),
    readShortenedLink: (responseBody) => (responseBody.startsWith("https://da.gd/") ? responseBody.trim() : undefined),
  },
  {
    serviceName: "clck.ru",
    buildShortenFetchRequest: (longLink) => ({
      fetchAddress: `https://clck.ru/--?url=${encodeURIComponent(longLink)}`,
      fetchInit: {},
    }),
    readShortenedLink: (responseBody) => (responseBody.startsWith("https://clck.ru/") ? responseBody.trim() : undefined),
  },
  {
    serviceName: "spoo.me",
    buildShortenFetchRequest: (longLink) => ({
      fetchAddress: "https://spoo.me/",
      fetchInit: {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new URLSearchParams({ url: longLink }),
      },
    }),
    readShortenedLink: (responseBody) => {
      if (!responseBody.startsWith("{")) return undefined;
      const parsedResponse = JSON.parse(responseBody) as { short_url?: unknown };
      return typeof parsedResponse.short_url === "string" && parsedResponse.short_url.startsWith("http")
        ? parsedResponse.short_url.replace("http://", "https://")
        : undefined;
    },
  },
  {
    serviceName: "cleanuri.com",
    buildShortenFetchRequest: (longLink) => ({
      fetchAddress: "https://cleanuri.com/api/v1/shorten",
      fetchInit: { method: "POST", body: new URLSearchParams({ url: longLink }) },
    }),
    readShortenedLink: (responseBody) => {
      if (!responseBody.startsWith("{")) return undefined;
      const parsedResponse = JSON.parse(responseBody) as { result_url?: unknown };
      return typeof parsedResponse.result_url === "string" && parsedResponse.result_url.startsWith("http")
        ? parsedResponse.result_url
        : undefined;
    },
  },
];

// A shortener either answers in these eight seconds or is treated as unavailable: the next one is tried.
const shortenRequestTimeoutMs = 8000;

// The link under the QR code, ready for typing by hand. The long link shows until a shortener answers;
// when every shortener fails, the long link stays — the remote always has an address to type.
export function useShortenedJoinLink(longLink: string): string {
  const [shorteningResult, setShorteningResult] = useState<{ longLink: string; shortenedLink: string }>({ longLink, shortenedLink: longLink });
  useEffect(() => {
    let isRequestRelevant = true;
    void shortenLinkThroughAvailableService(longLink).then((serviceShortenedLink) => {
      if (isRequestRelevant && serviceShortenedLink !== undefined) setShorteningResult({ longLink, shortenedLink: serviceShortenedLink });
    });
    return () => {
      isRequestRelevant = false;
    };
  }, [longLink]);
  return shorteningResult.longLink === longLink ? shorteningResult.shortenedLink : longLink;
}

// Services are tried in a fresh random order on every call: the load spreads across them, and one dead
// service never blocks the rest. The first working answer wins.
async function shortenLinkThroughAvailableService(longLink: string): Promise<string | undefined> {
  for (const serviceIndex of shuffledServiceOrder()) {
    const shortenedLink = await requestShortenedLink(linkShortenerServices[serviceIndex]!, longLink);
    if (shortenedLink !== undefined) return shortenedLink;
  }
  return undefined;
}

function shuffledServiceOrder(): number[] {
  const serviceOrder = Array.from(linkShortenerServices.keys());
  for (let shuffleIndex = serviceOrder.length - 1; shuffleIndex > 0; shuffleIndex--) {
    const swapIndex = Math.floor(Math.random() * (shuffleIndex + 1));
    [serviceOrder[shuffleIndex], serviceOrder[swapIndex]] = [serviceOrder[swapIndex]!, serviceOrder[shuffleIndex]!];
  }
  return serviceOrder;
}

async function requestShortenedLink(shortenerService: LinkShortenerService, longLink: string): Promise<string | undefined> {
  try {
    const { fetchAddress, fetchInit } = shortenerService.buildShortenFetchRequest(longLink);
    const shortenResponse = await fetch(fetchAddress, { ...fetchInit, signal: AbortSignal.timeout(shortenRequestTimeoutMs) });
    if (!shortenResponse.ok) return undefined;
    return shortenerService.readShortenedLink(await shortenResponse.text());
  } catch {
    return undefined;
  }
}
