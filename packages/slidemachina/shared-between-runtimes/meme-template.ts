// A caption field of a memegen template in shares of the picture size; angle in degrees, counterclockwise as in memegen.
export type MemeCaptionField = {
  fieldLeft: number;
  fieldTop: number;
  fieldWidth: number;
  fieldHeight: number;
  fieldAngle: number;
  textColor: string;
  letterCase: "upper" | "lower" | "none";
  textAlign: "center" | "left";
  isThickFont: boolean;
};
// The slide source plugin reads images/memes/<template>/ and hands this to <Meme>.
export type MemeTemplateLayout = {
  templateName: string;
  pictureAddress: string;
  pictureWidth: number;
  pictureHeight: number;
  captionFields: MemeCaptionField[];
};
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
