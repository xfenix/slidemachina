// What the page reads off one printed slide: boxes in canvas pixels from the top left corner of the slide.
export type AppearanceEffect = "rise" | "fade" | "scale";
export type PaintColor = { colorHex: string; colorOpacity: number };
export type SlidePartBox = { leftEdge: number; upperEdge: number; boxWidth: number; boxHeight: number };
export type PartStep = { stepNumber: number; stepEffect: AppearanceEffect };
export type StrokeStyle = { strokeColor: PaintColor; strokeWidth: number; isDashed: boolean };
export type TextAlignment = "left" | "center" | "right" | "justify";
export type SlideTextRun = {
  runContent: string;
  startsLine: boolean;
  fontFamily: string;
  fontSize: number;
  isBoldFace: boolean;
  isItalic: boolean;
  isUnderlined: boolean;
  isStruck: boolean;
  textColor: PaintColor;
  letterSpacing: number;
  outlineStroke?: StrokeStyle;
  highlightColor?: PaintColor;
};
export type PathCommand =
  | { commandKind: "move" | "line"; endPoint: [number, number] }
  | { commandKind: "quadratic"; controlPoint: [number, number]; endPoint: [number, number] }
  | { commandKind: "cubic"; firstControlPoint: [number, number]; secondControlPoint: [number, number]; endPoint: [number, number] }
  | { commandKind: "close" };
export type TextPart = PartStep & SlidePartBox & { partKind: "text"; textRuns: SlideTextRun[]; textAlignment: TextAlignment; lineHeight: number; lineCount: number };
export type ShapePart = PartStep & SlidePartBox & { partKind: "shape"; fillColor?: PaintColor; cornerRadius: number; outlineStroke?: StrokeStyle };
export type LinePart = PartStep & { partKind: "line"; startPoint: [number, number]; endPoint: [number, number]; drawnStroke: StrokeStyle };
export type PathPart = PartStep & { partKind: "path"; pathCommands: PathCommand[]; fillColor?: PaintColor; drawnStroke?: StrokeStyle };
// A picture is taken after reading: the mark names the element, or the slide itself for what no native object covers.
export type PicturePart = PartStep & { partKind: "picture"; captureMark: string; animatedSource?: string; contentBox?: SlidePartBox };
export type VideoPart = PartStep & SlidePartBox & { partKind: "video"; videoSource: string; captureMark: string };
export type SlidePart = TextPart | ShapePart | LinePart | PathPart | PicturePart | VideoPart;
export type ExportedPage = { pageIndex: number; isStepFrame: boolean };
export type SlideLayout = { slideBackground?: PaintColor; stepDuration: number; slideParts: SlidePart[] };
