import { fetchFromSource } from "./source-fetching.ts";
import { SourceEditProblem } from "../development-server/source-rewriting.ts";
import type { GiphyClip } from "../../shared-between-runtimes/meme-template.ts";

type GiphyRendition = { url?: string, mp4?: string, webp?: string };
type GiphyEntry = { id: string, title?: string, url: string, images: { original: GiphyRendition, fixed_width?: GiphyRendition } };

// A free key from developers.giphy.com: 100 requests an hour. Without it there is no GIF search at all.
const giphyKey = process.env.SLIDEMACHINA_GIPHY_KEY;
const giphyAddress = process.env.SLIDEMACHINA_GIPHY_ADDRESS ?? "https://api.giphy.com";
const clipLimit = 24;
// Slides are shown at work: clips rated PG at most.
const clipRating = "pg";
const foundClips = new Map<string, Promise<GiphyClip[]>>();

export function isGiphyOn(): boolean {
  return Boolean(giphyKey);
}

function readClip(giphyEntry: GiphyEntry): GiphyClip {
  const previewRendition = giphyEntry.images.fixed_width ?? giphyEntry.images.original;
  return {
    clipId: giphyEntry.id,
    clipTitle: (giphyEntry.title ?? "").replace(/\s+GIF(\s+by\s+.*)?$/i, ""),
    pageAddress: giphyEntry.url,
    previewAddress: previewRendition.webp ?? previewRendition.url ?? "",
    videoAddress: giphyEntry.images.original.mp4 ?? "",
  };
}

async function requestGiphy(requestPath: string, requestParameters: Record<string, string>): Promise<unknown> {
  if (!giphyKey) throw new SourceEditProblem("giphyKeyMissing");
  const requestAddress = `${giphyAddress}${requestPath}?${new URLSearchParams({ api_key: giphyKey, ...requestParameters }).toString()}`;
  const giphyResponse = await fetchFromSource(requestAddress);
  if (!giphyResponse.ok) throw new SourceEditProblem("memeNetworkFailed", `GIPHY: ${giphyResponse.status}`);
  return ((await giphyResponse.json()) as { data: unknown }).data;
}

async function requestGiphySearch(searchQuery: string): Promise<GiphyClip[]> {
  const queryLanguage = /[а-яё]/i.test(searchQuery) ? "ru" : "en";
  const giphyEntries = (await requestGiphy("/v1/gifs/search", { q: searchQuery, limit: String(clipLimit), rating: clipRating, lang: queryLanguage })) as GiphyEntry[];
  return giphyEntries.map(readClip).filter((giphyClip) => giphyClip.videoAddress !== "");
}

// GIPHY ranks clips for the language of the query: Cyrillic asks for Russian ones. A repeated query is not counted twice against the limit.
export function searchGiphyClips(searchQuery: string): Promise<GiphyClip[]> {
  const trimmedQuery = searchQuery.trim().toLowerCase();
  if (!isGiphyOn() || trimmedQuery === "") return Promise.resolve([]);
  const searchRequest = foundClips.get(trimmedQuery) ?? requestGiphySearch(trimmedQuery);
  foundClips.set(trimmedQuery, searchRequest);
  void searchRequest.catch(() => foundClips.delete(trimmedQuery));
  return searchRequest;
}

export async function fetchGiphyClip(clipId: string): Promise<GiphyClip> {
  return readClip((await requestGiphy(`/v1/gifs/${encodeURIComponent(clipId)}`, {})) as GiphyEntry);
}
