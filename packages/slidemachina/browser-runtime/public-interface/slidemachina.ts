export { Presentation, type PresentationProperties } from "../presentation-core/presentation-component.tsx";
export { Section, type SectionProperties } from "../presentation-core/section-component.tsx";
export { Slide, type SlideProperties } from "../presentation-core/slide-component.tsx";
export { List, type ListProperties } from "../slide-steps/list-component.tsx";
export { Step, type StepProperties } from "../slide-steps/step-component.tsx";
export { Code, type CodeProperties } from "../code-blocks/code-component.tsx";
export { Image, type ImageProperties } from "../content-blocks/image-component.tsx";
export { Video, type VideoProperties } from "../content-blocks/video-component.tsx";
export type { MediaFit } from "../content-blocks/media-frame.tsx";
export { Columns, type ColumnsProperties } from "../content-blocks/columns-component.tsx";
export { Table, type TableProperties } from "../content-blocks/table-component.tsx";
export { Quote, type QuoteProperties } from "../content-blocks/quote-component.tsx";
export { BigNumber, type BigNumberProperties } from "../content-blocks/big-number-component.tsx";
export { Caption, type CaptionProperties } from "../content-blocks/caption-component.tsx";
export { Source, type SourceProperties } from "../content-blocks/source-component.tsx";
export { Diagram, type DiagramProperties } from "../diagram-blocks/diagram-component.tsx";
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
export { Actor, Message, Sequence, type ActorProperties, type MessageProperties, type SequenceProperties } from "../diagram-blocks/sequence-component.tsx";
export { Scene, type SceneProperties } from "../scene-blocks/scene-component.tsx";
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
} from "../scene-blocks/scene-parts.tsx";
export type { DiagramDirection } from "../diagram-blocks/diagram-graph.ts";
export type { PresentationLogo, SlideAlign } from "../presentation-core/slide-environment.ts";
export type { SlideTransition } from "../slide-transitions/slide-transition.ts";
export type { StepEffect } from "../slide-steps/step-attributes.ts";

// <div morph="database"> pairs two elements on neighbouring slides when the text or source does not match.
declare module "react" {
  interface HTMLAttributes<T> {
    morph?: string;
  }
}
