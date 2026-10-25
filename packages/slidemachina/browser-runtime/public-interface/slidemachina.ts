import type { StepEffect } from "../slide-steps/step-attributes.ts";

export { Presentation, type PresentationProperties } from "../presentation-core/presentation-component.tsx";
export { Section, type SectionProperties } from "../presentation-core/section-component.tsx";
export { Slide, type SlideLogoPlacement, type SlideProperties } from "../presentation-core/slide-component.tsx";
export { List, type ListProperties } from "../slide-steps/list-component.tsx";
export { Code, type CodeProperties } from "../content-blocks/code-block/code-component.tsx";
export { Image, type ImageProperties } from "../content-blocks/image-block/image-component.tsx";
export { Video, type VideoProperties } from "../content-blocks/video-block/video-component.tsx";
export type { MediaFit } from "../content-blocks/media-frame.tsx";
export { Columns, type ColumnsProperties } from "../content-blocks/columns-block/columns-component.tsx";
export { Table, type TableProperties } from "../content-blocks/table-block/table-component.tsx";
export { Quote, type QuoteProperties } from "../content-blocks/quote-block/quote-component.tsx";
export { BigNumber, type BigNumberProperties } from "../content-blocks/big-number-block/big-number-component.tsx";
export { Caption, type CaptionProperties } from "../content-blocks/caption-block/caption-component.tsx";
export { Source, type SourceProperties } from "../content-blocks/source-block/source-component.tsx";
export { QR, type QRProperties } from "../content-blocks/qr-block/qr-component.tsx";
export type { QRCorrection } from "../content-blocks/qr-block/qr-module-shapes.ts";
export { Diagram, type DiagramProperties } from "../diagram-blocks/diagram-block/diagram-component.tsx";
export {
  Arrow,
  Box,
  Focus,
  Group,
  type ArrowProperties,
  type BoxProperties,
  type FocusProperties,
  type GroupProperties,
} from "../diagram-blocks/diagram-parts.tsx";
export { Actor, Message, Sequence, type ActorProperties, type MessageProperties, type SequenceProperties } from "../diagram-blocks/sequence-block/sequence-component.tsx";
export { Scene, type SceneProperties } from "../scene-blocks/scene-block/scene-component.tsx";
export {
  Camera,
  Cube,
  Light,
  Move,
  Sphere,
  Text,
  type CameraProperties,
  type CubeProperties,
  type LightProperties,
  type MoveProperties,
  type SceneMaterial,
  type ScenePoint,
  type SphereProperties,
  type TextProperties,
} from "../scene-blocks/scene-block/scene-parts.tsx";
export type { DiagramDirection } from "../diagram-blocks/diagram-block/diagram-graph.ts";
export { SlidemachinaLogo } from "../presentation-core/slidemachina-logo.tsx";
export type { PresentationLogo, SlideAlign } from "../presentation-core/slide-environment.ts";
export type { SlideTransition } from "../slide-transitions/slide-transition.ts";
export type { TransitionSpeed } from "../slide-transitions/transition-speed.ts";
export type { StepEffect } from "../slide-steps/step-attributes.ts";

// <div morph="database"> pairs two elements on neighbouring slides when the text or source does not match.
declare module "react" {
  interface HTMLAttributes<T> {
    morph?: string;
  }
  // <li data-step={2} data-step-effect="fade"> turns any element into a step.
  interface DOMAttributes<T> {
    "data-step"?: boolean | number;
    "data-step-effect"?: StepEffect;
  }
}
