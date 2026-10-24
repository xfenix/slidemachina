import type { ReactNode } from "react";

// [x, y, z] in scene units; rotation is in degrees.
export type ScenePoint = [number, number, number];
export type SceneMaterial = "matte" | "glossy" | "metal";
type SceneStepProperties = {
  step?: boolean | number;
};
type SceneObjectProperties = SceneStepProperties & {
  id?: string;
  position?: ScenePoint;
  rotation?: ScenePoint;
  scale?: number;
  color?: string;
  material?: SceneMaterial;
  // Degrees per second around the vertical axis; true is a slow turn.
  spin?: boolean | number;
};
export type CubeProperties = SceneObjectProperties & {
  size?: number | ScenePoint;
};
export type SphereProperties = SceneObjectProperties & {
  size?: number;
};
export type TextProperties = SceneObjectProperties & {
  children?: ReactNode;
  size?: number;
};
export type LightProperties = SceneStepProperties & {
  position?: ScenePoint;
  color?: string;
  intensity?: number;
};
export type CameraProperties = SceneStepProperties & {
  position?: ScenePoint;
  target?: ScenePoint;
  fov?: number;
};
export type MoveProperties = SceneStepProperties & {
  on: string;
  position?: ScenePoint;
  rotation?: ScenePoint;
  scale?: number;
  color?: string;
};

// Parts only describe the scene: <Scene> reads their props and draws everything with three.js.
export const Cube: (cubeProperties: CubeProperties) => null = () => null;
export const Sphere: (sphereProperties: SphereProperties) => null = () => null;
export const Text: (textProperties: TextProperties) => null = () => null;
export const Light: (lightProperties: LightProperties) => null = () => null;
export const Camera: (cameraProperties: CameraProperties) => null = () => null;
export const Move: (moveProperties: MoveProperties) => null = () => null;
