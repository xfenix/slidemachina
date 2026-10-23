import { Children, type ReactNode } from "react";
import { listMarkupElements } from "../presentation-core/markup-elements.ts";
import {
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
  type SphereProperties,
  type TextProperties,
} from "./scene-parts.tsx";

export type ScenePart =
  | { partKind: "cube"; partProperties: CubeProperties }
  | { partKind: "sphere"; partProperties: SphereProperties }
  | { partKind: "text"; partProperties: TextProperties; textContent: string }
  | { partKind: "light"; partProperties: LightProperties }
  | { partKind: "camera"; partProperties: CameraProperties }
  | { partKind: "move"; partProperties: MoveProperties };

export type SceneObjectPart = Extract<ScenePart, { partKind: "cube" | "sphere" | "text" }>;

function collectText(textChildren: ReactNode): string {
  return Children.toArray(textChildren)
    .filter((textChild) => typeof textChild === "string" || typeof textChild === "number")
    .join("");
}

export function outlineSceneParts(sceneChildren: ReactNode): ScenePart[] {
  return listMarkupElements(sceneChildren).flatMap((markupElement): ScenePart[] => {
    const partProperties = markupElement.props as never;
    if (markupElement.type === Cube) return [{ partKind: "cube", partProperties }];
    if (markupElement.type === Sphere) return [{ partKind: "sphere", partProperties }];
    if (markupElement.type === Text) {
      return [{ partKind: "text", partProperties, textContent: collectText((partProperties as TextProperties).children) }];
    }
    if (markupElement.type === Light) return [{ partKind: "light", partProperties }];
    if (markupElement.type === Camera) return [{ partKind: "camera", partProperties }];
    if (markupElement.type === Move) return [{ partKind: "move", partProperties }];
    return [];
  });
}

export function isSceneObjectPart(scenePart: ScenePart): scenePart is SceneObjectPart {
  return scenePart.partKind === "cube" || scenePart.partKind === "sphere" || scenePart.partKind === "text";
}
