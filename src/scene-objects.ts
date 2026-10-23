import {
  DirectionalLight,
  Mesh,
  MeshPhysicalMaterial,
  PlaneGeometry,
  ShadowMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { resolveSceneColor } from "./scene-colors.ts";
import type { ScenePart, SceneObjectPart } from "./scene-outline.ts";
import type { SceneMaterial, ScenePoint } from "./scene-parts.tsx";
import { createTextMesh } from "./scene-text.ts";

export type SceneLook = {
  probeElement: HTMLElement;
  objectColor: string;
  textColor: string;
  fontFamily: string;
  fontWeight: string;
  shadowOpacity: number;
};

export type SceneLight = {
  partPosition: number | undefined;
  directionalLight: DirectionalLight;
  fullIntensity: number;
  lightDirection: Vector3;
};

const defaultLightPosition: ScenePoint = [-4, 7, 5];
const defaultLightIntensity = 1.6;
const shadowReachShare = 1.8;

function createSurfaceMaterial(materialName: SceneMaterial | undefined): Material {
  if (materialName === "metal") return new MeshPhysicalMaterial({ metalness: 1, roughness: 0.28 });
  if (materialName === "glossy") return new MeshPhysicalMaterial({ roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 });
  return new MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.45 });
}

function createSolidGeometry(objectPart: Exclude<SceneObjectPart, { partKind: "text" }>): BufferGeometry {
  if (objectPart.partKind === "sphere") return new SphereGeometry((objectPart.partProperties.size ?? 1) / 2, 96, 64);
  const cubeSize = objectPart.partProperties.size ?? 1;
  const [cubeWidth, cubeHeight, cubeDepth] = typeof cubeSize === "number" ? [cubeSize, cubeSize, cubeSize] : cubeSize;
  // Rounded edges catch the light along the rims, the way product renders look.
  return new RoundedBoxGeometry(cubeWidth, cubeHeight, cubeDepth, 5, Math.min(cubeWidth, cubeHeight, cubeDepth) * 0.12);
}

export function buildObjectMesh(objectPart: SceneObjectPart, sceneLook: SceneLook): Mesh {
  if (objectPart.partKind === "text") {
    return createTextMesh(objectPart.textContent, objectPart.partProperties.size ?? 0.5, sceneLook);
  }
  const objectMesh = new Mesh(createSolidGeometry(objectPart), createSurfaceMaterial(objectPart.partProperties.material));
  objectMesh.castShadow = true;
  return objectMesh;
}

function createDirectionalLight(lightPosition: ScenePoint, lightColor: string | undefined, sceneLook: SceneLook) {
  const directionalLight = new DirectionalLight(resolveSceneColor(sceneLook.probeElement, lightColor ?? "#ffffff"));
  return { directionalLight, lightDirection: new Vector3(...lightPosition).normalize() };
}

// Without <Light> the scene gets one soft key light from the upper left; only the first light casts a shadow.
export function buildSceneLights(sceneParts: ScenePart[], sceneLook: SceneLook): SceneLight[] {
  const sceneLights: SceneLight[] = sceneParts.flatMap((scenePart, partPosition) => {
    if (scenePart.partKind !== "light") return [];
    const { position = defaultLightPosition, color, intensity = defaultLightIntensity } = scenePart.partProperties;
    return [{ partPosition, fullIntensity: intensity, ...createDirectionalLight(position, color, sceneLook) }];
  });
  if (sceneLights.length === 0) {
    sceneLights.push({ partPosition: undefined, fullIntensity: defaultLightIntensity, ...createDirectionalLight(defaultLightPosition, undefined, sceneLook) });
  }
  const shadowLight = sceneLights[0].directionalLight;
  shadowLight.castShadow = true;
  shadowLight.shadow.mapSize.set(2048, 2048);
  shadowLight.shadow.radius = 14;
  shadowLight.shadow.blurSamples = 24;
  shadowLight.shadow.bias = -0.0004;
  return sceneLights;
}

// The light looks at the middle of the scene from far enough away; its shadow box covers the floor under all objects.
export function aimSceneLight(sceneLight: SceneLight, sceneCentre: Vector3, sceneRadius: number) {
  const { directionalLight, lightDirection } = sceneLight;
  directionalLight.target.position.copy(sceneCentre);
  directionalLight.position.copy(sceneCentre).addScaledVector(lightDirection, sceneRadius * 3);
  const shadowCamera = directionalLight.shadow.camera;
  const shadowReach = sceneRadius * shadowReachShare;
  Object.assign(shadowCamera, { left: -shadowReach, right: shadowReach, top: shadowReach, bottom: -shadowReach, near: 0.1, far: sceneRadius * 6 });
  shadowCamera.updateProjectionMatrix();
}

// An invisible floor as large as the shadow box only catches the shadow; a smaller one leaves a stray line.
export function buildShadowFloor(sceneCentre: Vector3, sceneRadius: number, floorLevel: number, shadowOpacity: number): Mesh {
  const floorSize = sceneRadius * shadowReachShare * 2;
  const shadowFloor = new Mesh(new PlaneGeometry(floorSize, floorSize), new ShadowMaterial({ opacity: shadowOpacity }));
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.set(sceneCentre.x, floorLevel, sceneCentre.z);
  shadowFloor.receiveShadow = true;
  return shadowFloor;
}
