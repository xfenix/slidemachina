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

const defaultLightPosition: ScenePoint = [-4, 7, 5];
const defaultLightIntensity = 1.6;
const shadowReachShare = 1.8;
const metalRoughness = 0.28;
const glossyRoughness = 0.22;
const glossyClearcoatRoughness = 0.06;
const matteRoughness = 0.5;
const matteClearcoat = 0.35;
const matteClearcoatRoughness = 0.45;
const sphereWidthSegments = 96;
const sphereHeightSegments = 64;
// Rounded edges catch the light along the rims, the way product renders look.
const roundedEdgeSegments = 5;
const roundedEdgeShare = 0.12;
const shadowMapSize = 2048;
const shadowRadius = 14;
const shadowBlurSampleCount = 24;
const shadowBias = -0.0004;
const lightDistanceShare = 3;
const shadowNearLevel = 0.1;
const shadowFarShare = 6;

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

function createSurfaceMaterial(materialName: SceneMaterial | undefined): Material {
  if (materialName === "metal") return new MeshPhysicalMaterial({ metalness: 1, roughness: metalRoughness });
  if (materialName === "glossy") return new MeshPhysicalMaterial({ roughness: glossyRoughness, clearcoat: 1, clearcoatRoughness: glossyClearcoatRoughness });
  return new MeshPhysicalMaterial({ roughness: matteRoughness, clearcoat: matteClearcoat, clearcoatRoughness: matteClearcoatRoughness });
}

function createSolidGeometry(objectPart: Exclude<SceneObjectPart, { partKind: "text" }>): BufferGeometry {
  if (objectPart.partKind === "sphere") return new SphereGeometry((objectPart.partProperties.size ?? 1) / 2, sphereWidthSegments, sphereHeightSegments);
  const cubeSize = objectPart.partProperties.size ?? 1;
  const [cubeWidth, cubeHeight, cubeDepth] = typeof cubeSize === "number" ? [cubeSize, cubeSize, cubeSize] : cubeSize;
  return new RoundedBoxGeometry(cubeWidth, cubeHeight, cubeDepth, roundedEdgeSegments, Math.min(cubeWidth, cubeHeight, cubeDepth) * roundedEdgeShare);
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
  shadowLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  shadowLight.shadow.radius = shadowRadius;
  shadowLight.shadow.blurSamples = shadowBlurSampleCount;
  shadowLight.shadow.bias = shadowBias;
  return sceneLights;
}

// The light looks at the middle of the scene from far enough away; its shadow box covers the floor under all objects.
export function aimSceneLight(sceneLight: SceneLight, sceneCentre: Vector3, sceneRadius: number) {
  const { directionalLight, lightDirection } = sceneLight;
  directionalLight.target.position.copy(sceneCentre);
  directionalLight.position.copy(sceneCentre).addScaledVector(lightDirection, sceneRadius * lightDistanceShare);
  const shadowCamera = directionalLight.shadow.camera;
  const shadowReach = sceneRadius * shadowReachShare;
  Object.assign(shadowCamera, { left: -shadowReach, right: shadowReach, top: shadowReach, bottom: -shadowReach, near: shadowNearLevel, far: sceneRadius * shadowFarShare });
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
