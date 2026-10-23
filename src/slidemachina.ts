export { Presentation, type PresentationProperties } from "./presentation.tsx";
export { Section, type SectionProperties } from "./section-marker.tsx";
export { Slide, type SlideProperties } from "./slide-frame.tsx";
export { List, type ListProperties } from "./step-list.tsx";
export { Step, type StepProperties } from "./step-reveal.tsx";
export { Code, type CodeProperties } from "./code-block.tsx";
export { Image, Video, type ImageProperties, type VideoProperties, type MediaFit } from "./media-blocks.tsx";
export { Columns, type ColumnsProperties } from "./column-layout.tsx";
export { Table, type TableProperties } from "./table-block.tsx";
export { Quote, type QuoteProperties } from "./quote-block.tsx";
export { BigNumber, type BigNumberProperties } from "./big-number.tsx";
export { Caption, Source, type CaptionProperties } from "./caption-blocks.tsx";
export { Diagram, type DiagramProperties } from "./diagram-block.tsx";
export {
  Arrow,
  Box,
  Focus,
  Group,
  type ArrowProperties,
  type BoxProperties,
  type FocusProperties,
  type GroupProperties,
} from "./diagram-parts.tsx";
export { Actor, Message, Sequence, type ActorProperties, type MessageProperties, type SequenceProperties } from "./sequence-block.tsx";
export { Scene, type SceneProperties } from "./scene-block.tsx";
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
} from "./scene-parts.tsx";
export type { DiagramDirection } from "./diagram-graph.ts";
export type { PresentationLogo, SlideAlign } from "./slide-environment.ts";
export type { SlideTransition } from "./slide-transition.ts";
export type { StepEffect } from "./step-attributes.ts";

// <div morph="database"> pairs two elements on neighbouring slides when the text or source does not match.
declare module "react" {
  interface HTMLAttributes<T> {
    morph?: string;
  }
}
