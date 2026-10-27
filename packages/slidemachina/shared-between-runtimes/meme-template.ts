// What the meme search finds: memegen templates always, GIPHY clips only with a key.
export type MemeTemplateSummary = {
  templateId: string;
  templateName: string;
  captionCount: number;
  keywords: string[];
  previewAddress: string;
  isAnimatable: boolean;
};
export type GiphyClip = {
  clipId: string;
  clipTitle: string;
  pageAddress: string;
  previewAddress: string;
  videoAddress: string;
};
// A meme added from the panel or the command: a memegen template id, a GIPHY clip id or a link.
export type MemeKind = "template" | "clip" | "link";
export type MemeSearchAnswer = { memeTemplates: MemeTemplateSummary[]; giphyClips: GiphyClip[]; isGiphyOn: boolean };
