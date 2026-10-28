import { useLayoutEffect, useRef } from "react";
import * as Machina from "slidemachina";

type PixelSize = { pixelWidth: number; pixelHeight: number };
type ShaderPainter = {
  paintedCanvas: HTMLCanvasElement;
  paintFrame: (pixelSize: PixelSize, sunriseShare: number, elapsedSeconds: number, pointerX: number, pointerY: number) => void;
  isPainterLost: () => boolean;
  releasePainter: () => void;
};

const sunriseSeconds = 4.5;
const settledSunriseShare = 1;
const stillFrameSeconds = 0;
const millisecondsPerSecond = 1000;
const pointerFollowShare = 0.06;
const halfWindowShare = 0.5;
const fullScreenTriangle = new Float32Array([-1, -1, 3, -1, -1, 3]);
const triangleVertexCount = 3;
const vertexComponentCount = 2;
const stillPictureFormat = "image/jpeg";
const stillPictureQuality = 0.85;
const slowFrameMilliseconds = 20;
const slowFrameStreakLimit = 30;
const pixelShareReduction = 0.75;
const smallestPixelShare = 0.5;

let stillPicturePainter: ShaderPainter | undefined;
const stillPictureAddresses = new Map<string, string>();

const vertexShaderSource = `#version 300 es
in vec2 screenCorner;
void main() { gl_Position = vec4(screenCorner, 0.0, 1.0); }
`;

// The Earth from orbit at sunrise. The planet is a ray-traced sphere: eroded noise relief, oceans with a sun glint, clouds with
// their own relief and shadows on the ground, city lights. Sunlight passes through a Rayleigh and Mie atmosphere, so the limb
// is blue, the terminator and the low sun turn red. The glare is drawn in screen space around the sun. No textures.
const fragmentShaderSource = `#version 300 es
precision highp float;
uniform vec2 viewportSize;
uniform float elapsedSeconds;
uniform float sunriseShare;
uniform vec2 pointerOffset;
out vec4 fragmentColor;

const float circleConstant = 3.14159265;
const float focalLength = 1.6;
const float cameraParallax = 0.035;
const float cameraRoll = -0.1;
const float planetRadius = 1.0;
const vec3 planetCentre = vec3(0.0, -1.0, 0.82);
const vec3 planetPoleAxis = normalize(vec3(-0.5, 0.45, 0.75));
const float planetSpinSpeed = 0.006;
const float cloudDriftSpeed = 0.004;
const vec3 hiddenSunDirection = vec3(0.22, -0.1, 1.0);
const vec3 risenSunDirection = vec3(0.22, -0.01, 1.0);
const vec3 lightLeanTowardCamera = vec3(0.35, 0.12, -0.42);
const vec3 moonDirection = normalize(vec3(-0.3, 0.5, -0.8));
const float atmosphereRadius = 1.045;
const float rayleighScaleHeight = 0.004;
const float mieScaleHeight = 0.0012;
const vec3 rayleighScattering = vec3(3.7, 8.7, 21.2);
const vec3 ozoneAbsorption = vec3(0.55, 1.6, 0.07);
const float mieScattering = 1.4;
const float mieExtinctionShare = 1.11;
const float mieAnisotropy = 0.95;
const float earthShadowSoftness = 0.004;
const int viewSampleCount = 12;
const int sunSampleCount = 5;
const int sunPathSampleCount = 24;
const float sunIntensity = 22.0;
const vec3 sunTint = vec3(1.0, 0.95, 0.88);
const float sunDiscCosine = 0.99993;
const float sunDiscEdge = 0.00002;
const float sunDiscRadiance = 900.0;
const float limbDarkening = 0.55;
const float moonIntensity = 0.02;
const vec3 moonTint = vec3(0.55, 0.7, 1.0);
const vec3 skyFillColor = vec3(0.05, 0.1, 0.22);
const float continentFrequency = 2.2;
const float continentWarpFrequency = 1.3;
const float continentWarpStrength = 0.9;
const int terrainOctaveCount = 8;
const float erosionStrength = 0.15;
const float terrainOctaveGain = 0.5;
const float cloudOctaveGain = 0.6;
const float seaLevel = 0.02;
const float coastSharpness = 0.006;
const float reliefStrength = 0.1;
const float moistureFrequency = 3.0;
const vec3 deepOceanColor = vec3(0.002, 0.011, 0.035);
const vec3 shallowOceanColor = vec3(0.01, 0.07, 0.09);
const vec3 forestColor = vec3(0.04, 0.08, 0.025);
const vec3 grasslandColor = vec3(0.12, 0.14, 0.05);
const vec3 desertColor = vec3(0.45, 0.3, 0.16);

const vec3 rockColor = vec3(0.12, 0.09, 0.07);
const vec3 snowColor = vec3(0.75, 0.8, 0.86);
const float oceanRoughness = 0.11;
const float oceanReflectance = 0.02;
const float grazingFloor = 0.05;
const vec3 cityLightColor = vec3(1.0, 0.6, 0.25);
const float cityLightIntensity = 1.5;
const float cityClusterFrequency = 14.0;
const float cityTownFrequency = 110.0;
const float cityStreetFrequency = 420.0;
const float citySpotSharpness = 70.0;
const float cloudShellRadius = 1.006;
const float cloudFrequency = 5.5;
const float cloudBandStretch = 1.2;
const float cloudWarpFrequency = 0.7;
const float cloudWarpStrength = 0.6;
const int cloudOctaveCount = 7;
const int cloudShadowOctaveCount = 3;
const float cloudCoverThreshold = 0.03;
const float cloudCoverSoftness = 0.07;

const float cloudReliefStrength = 0.025;
const float cloudWrapLight = 0.3;
const float cloudShadowDepth = 0.75;
const float cloudShadowFacingFloor = 0.08;
const vec3 cloudAlbedo = vec3(0.85);
const vec3 airglowColor = vec3(0.25, 0.9, 0.35);
const float airglowAltitude = 0.016;
const float airglowThickness = 0.002;
const float airglowIntensity = 0.03;
const vec3 dawnGlowColor = vec3(1.0, 0.38, 0.1);
const vec3 streakBlue = vec3(0.45, 0.65, 1.0);
const float ghostPositions[4] = float[4](-0.35, -0.7, -1.2, 0.45);
const float nightExposure = 1.5;

const float dayExposure = 0.6;
const float vignetteStrength = 0.35;
const float grainStrength = 0.025;
const mat3 octaveRotation = mat3(0.0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64);
const mat3 acesInputMatrix = mat3(0.59719, 0.076, 0.0284, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
const mat3 acesOutputMatrix = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);

float hashPoint(vec3 samplePoint) {
  samplePoint = fract(samplePoint * 0.3183099 + 0.1);
  samplePoint *= 17.0;
  return fract(samplePoint.x * samplePoint.y * samplePoint.z * (samplePoint.x + samplePoint.y + samplePoint.z));
}

// Value noise and its exact gradient: the gradient bends normals for relief without extra noise samples.
vec4 sampleSlopedNoise(vec3 samplePoint) {
  vec3 cellCorner = floor(samplePoint);
  vec3 cellShare = fract(samplePoint);
  vec3 easedShare = cellShare * cellShare * (3.0 - 2.0 * cellShare);
  vec3 easedSlope = 6.0 * cellShare * (1.0 - cellShare);
  vec4 lowerCorners = vec4(hashPoint(cellCorner), hashPoint(cellCorner + vec3(1, 0, 0)), hashPoint(cellCorner + vec3(0, 1, 0)), hashPoint(cellCorner + vec3(1, 1, 0)));
  vec4 upperCorners = vec4(hashPoint(cellCorner + vec3(0, 0, 1)), hashPoint(cellCorner + vec3(1, 0, 1)), hashPoint(cellCorner + vec3(0, 1, 1)), hashPoint(cellCorner + vec3(1, 1, 1)));
  float edgeAlongX = lowerCorners.y - lowerCorners.x;
  float edgeAlongY = lowerCorners.z - lowerCorners.x;
  float edgeAlongZ = upperCorners.x - lowerCorners.x;
  float faceAcrossXY = lowerCorners.x - lowerCorners.y - lowerCorners.z + lowerCorners.w;
  float faceAcrossYZ = lowerCorners.x - lowerCorners.z - upperCorners.x + upperCorners.z;
  float faceAcrossZX = lowerCorners.x - lowerCorners.y - upperCorners.x + upperCorners.y;
  float cubeInterior = -faceAcrossXY + upperCorners.x - upperCorners.y - upperCorners.z + upperCorners.w;
  float noiseValue = lowerCorners.x + edgeAlongX * easedShare.x + edgeAlongY * easedShare.y + edgeAlongZ * easedShare.z
    + faceAcrossXY * easedShare.x * easedShare.y + faceAcrossYZ * easedShare.y * easedShare.z + faceAcrossZX * easedShare.z * easedShare.x
    + cubeInterior * easedShare.x * easedShare.y * easedShare.z;
  vec3 noiseSlope = easedSlope * vec3(
    edgeAlongX + faceAcrossXY * easedShare.y + faceAcrossZX * easedShare.z + cubeInterior * easedShare.y * easedShare.z,
    edgeAlongY + faceAcrossYZ * easedShare.z + faceAcrossXY * easedShare.x + cubeInterior * easedShare.z * easedShare.x,
    edgeAlongZ + faceAcrossZX * easedShare.x + faceAcrossYZ * easedShare.y + cubeInterior * easedShare.x * easedShare.y);
  return vec4(noiseValue, noiseSlope);
}

// Centred fractal noise with its gradient. Steep octaves damp the finer ones, like erosion smooths valleys and keeps ridges.
vec4 sumFractalSlope(vec3 samplePoint, int octaveCount, float erosionWeight, float octaveGain) {
  float heightTotal = 0.0;
  vec3 slopeTotal = vec3(0.0);
  vec3 rawSlopeTotal = vec3(0.0);
  float octaveWeight = 0.5;
  mat3 octaveFrame = mat3(1.0);
  for (int octaveIndex = 0; octaveIndex < terrainOctaveCount; octaveIndex++) {
    if (octaveIndex >= octaveCount) break;
    vec4 noiseSample = sampleSlopedNoise(samplePoint);
    vec3 octaveSlope = noiseSample.yzw * octaveFrame;
    rawSlopeTotal += octaveWeight * octaveSlope;
    float erosionShare = 1.0 / (1.0 + erosionWeight * dot(rawSlopeTotal, rawSlopeTotal));
    heightTotal += octaveWeight * (noiseSample.x - 0.5) * erosionShare;
    slopeTotal += octaveWeight * octaveSlope * erosionShare;
    samplePoint = octaveRotation * samplePoint * 2.0 + vec3(1.7, 9.2, 3.1);
    octaveFrame = octaveRotation * octaveFrame * 2.0;
    octaveWeight *= octaveGain;
  }
  return vec4(heightTotal, slopeTotal);
}

vec3 rotateAroundAxis(vec3 rotatedVector, vec3 rotationAxis, float rotationAngle) {
  float angleCosine = cos(rotationAngle);
  return rotatedVector * angleCosine + cross(rotationAxis, rotatedVector) * sin(rotationAngle) + rotationAxis * dot(rotationAxis, rotatedVector) * (1.0 - angleCosine);
}

vec3 bendNormal(vec3 surfaceNormal, vec3 heightSlope, float bendStrength) {
  return normalize(surfaceNormal - (heightSlope - surfaceNormal * dot(heightSlope, surfaceNormal)) * bendStrength);
}

// Distances to where the ray enters and leaves a sphere around the planet centre; both negative on a miss.
vec2 intersectSphere(vec3 rayOrigin, vec3 rayDirection, float sphereRadius) {
  vec3 fromCentre = rayOrigin - planetCentre;
  float halfChord = dot(fromCentre, rayDirection);
  float hitDiscriminant = halfChord * halfChord - dot(fromCentre, fromCentre) + sphereRadius * sphereRadius;
  if (hitDiscriminant < 0.0) return vec2(-1.0);
  float chordRoot = sqrt(hitDiscriminant);
  return vec2(-halfChord - chordRoot, -halfChord + chordRoot);
}

// Height of the ray above the planet at its closest point: negative inside the sphere.
float measureRayAltitude(vec3 rayOrigin, vec3 rayDirection) {
  vec3 fromCentre = rayOrigin - planetCentre;
  return length(fromCentre - rayDirection * dot(fromCentre, rayDirection)) - planetRadius;
}

vec2 measureAirDensity(vec3 samplePoint) {
  float sampleAltitude = max(length(samplePoint - planetCentre) - planetRadius, 0.0);
  return exp(-sampleAltitude / vec2(rayleighScaleHeight, mieScaleHeight));
}

vec3 computeExtinction(vec2 opticalDepth) {
  return (rayleighScattering + ozoneAbsorption) * opticalDepth.x + mieScattering * mieExtinctionShare * opticalDepth.y;
}

// Share of sunlight that reaches a point: zero in the planet's soft shadow, reddened on a long path through the air.
vec3 measureSunTransmittance(vec3 samplePoint, vec3 sunDirection) {
  vec3 fromCentre = samplePoint - planetCentre;
  float passAltitude = length(fromCentre - sunDirection * min(dot(fromCentre, sunDirection), 0.0)) - planetRadius;
  float shadowShare = smoothstep(-earthShadowSoftness, earthShadowSoftness, passAltitude + earthShadowSoftness);
  if (shadowShare <= 0.0) return vec3(0.0);
  float stepLength = max(intersectSphere(samplePoint, sunDirection, atmosphereRadius).y, 0.0) / float(sunSampleCount);
  vec2 opticalDepth = vec2(0.0);
  for (int sampleIndex = 0; sampleIndex < sunSampleCount; sampleIndex++) {
    opticalDepth += measureAirDensity(samplePoint + sunDirection * stepLength * (float(sampleIndex) + 0.5));
  }
  return exp(-computeExtinction(opticalDepth * stepLength)) * shadowShare;
}

// Single scattering along the view ray. Samples crowd where the air is dense: at the ground or around the closest approach.
vec3 scatterSunlight(vec3 rayOrigin, vec3 rayDirection, vec2 pathRange, bool endsOnGround, vec3 sunDirection, vec3 lightDirection, float sampleJitter, out vec3 viewTransmittance) {
  float pathLength = pathRange.y - pathRange.x;
  vec2 viewDepth = vec2(0.0);
  vec3 rayleighTotal = vec3(0.0);
  vec3 mieTotal = vec3(0.0);
  for (int sampleIndex = 0; sampleIndex < viewSampleCount; sampleIndex++) {
    float sampleShare = (float(sampleIndex) + sampleJitter) / float(viewSampleCount);
    float sampleDistance;
    float stepLength;
    if (endsOnGround) {
      sampleDistance = pathRange.y - pathLength * (1.0 - sampleShare) * (1.0 - sampleShare);
      stepLength = 2.0 * pathLength * (1.0 - sampleShare) / float(viewSampleCount);
    } else {
      float centredShare = 2.0 * sampleShare - 1.0;
      sampleDistance = pathRange.x + pathLength * 0.5 * (1.0 + centredShare * abs(centredShare));
      stepLength = 2.0 * pathLength * abs(centredShare) / float(viewSampleCount);
    }
    vec3 samplePoint = rayOrigin + rayDirection * sampleDistance;
    vec2 stepDensity = measureAirDensity(samplePoint) * stepLength;
    viewDepth += stepDensity;
    vec3 lightReach = measureSunTransmittance(samplePoint, lightDirection) * exp(-computeExtinction(viewDepth));
    rayleighTotal += lightReach * stepDensity.x;
    mieTotal += lightReach * stepDensity.y;
  }
  viewTransmittance = exp(-computeExtinction(viewDepth));
  float sunCosine = dot(rayDirection, sunDirection);
  float anisotropySquare = mieAnisotropy * mieAnisotropy;
  float rayleighPhase = 3.0 / (16.0 * circleConstant) * (1.0 + sunCosine * sunCosine);
  float miePhase = 3.0 / (8.0 * circleConstant) * (1.0 - anisotropySquare) * (1.0 + sunCosine * sunCosine)
    / ((2.0 + anisotropySquare) * pow(1.0 + anisotropySquare - 2.0 * mieAnisotropy * sunCosine, 1.5));
  return sunIntensity * sunTint * (rayleighTotal * rayleighScattering * rayleighPhase + mieTotal * mieScattering * miePhase);
}

// Sunlight seen straight from the camera: many samples, because the grazing path decides the colour of the rising sun.
vec3 measureSunColor(vec3 rayOrigin, vec3 sunDirection) {
  vec2 pathRange = intersectSphere(rayOrigin, sunDirection, atmosphereRadius);
  float stepLength = (pathRange.y - pathRange.x) / float(sunPathSampleCount);
  vec2 opticalDepth = vec2(0.0);
  for (int sampleIndex = 0; sampleIndex < sunPathSampleCount; sampleIndex++) {
    opticalDepth += measureAirDensity(rayOrigin + sunDirection * (pathRange.x + stepLength * (float(sampleIndex) + 0.5)));
  }
  return sunTint * exp(-computeExtinction(opticalDepth * stepLength));
}

vec4 shapeTerrain(vec3 planetPoint) {
  vec3 warpedPoint = planetPoint * continentFrequency + sampleSlopedNoise(planetPoint * continentWarpFrequency).yzw * continentWarpStrength;
  vec4 terrainSample = sumFractalSlope(warpedPoint, terrainOctaveCount, erosionStrength, terrainOctaveGain);
  return vec4(terrainSample.x - seaLevel, terrainSample.yzw * continentFrequency);
}

vec3 colorGround(vec3 planetPoint, float elevation) {
  float depthShare = smoothstep(0.0, 0.05, -elevation);
  vec3 oceanAlbedo = mix(shallowOceanColor, deepOceanColor, depthShare);
  float latitudeShare = abs(dot(planetPoint, planetPoleAxis));
  float subtropicDryness = exp(-pow((latitudeShare - 0.4) / 0.15, 2.0));
  float moistureShare = clamp(sampleSlopedNoise(planetPoint * moistureFrequency + 7.0).x * 1.6 - 0.05 - 0.45 * subtropicDryness + 2.0 * elevation, 0.0, 1.0);
  vec3 lowlandColor = mix(desertColor, mix(grasslandColor, forestColor, smoothstep(0.55, 0.9, moistureShare)), smoothstep(0.2, 0.5, moistureShare));
  vec3 landAlbedo = mix(lowlandColor, rockColor, smoothstep(0.13, 0.22, elevation));
  landAlbedo = mix(landAlbedo, snowColor, smoothstep(0.8, 0.9, latitudeShare + 1.5 * elevation));
  return mix(oceanAlbedo, landAlbedo, smoothstep(0.0, coastSharpness, elevation));
}

float measureCloudCover(vec3 planetPoint, int octaveCount, out vec3 coverSlope) {
  vec3 cloudPoint = rotateAroundAxis(planetPoint, planetPoleAxis, elapsedSeconds * cloudDriftSpeed) * cloudFrequency;
  cloudPoint += planetPoleAxis * dot(cloudPoint, planetPoleAxis) * cloudBandStretch;
  cloudPoint += sampleSlopedNoise(cloudPoint * cloudWarpFrequency).yzw * cloudWarpStrength;
  vec4 cloudSample = sumFractalSlope(cloudPoint, octaveCount, 0.0, cloudOctaveGain);
  coverSlope = cloudSample.yzw * cloudFrequency;
  return smoothstep(cloudCoverThreshold, cloudCoverThreshold + cloudCoverSoftness, cloudSample.x);
}

// One round light per noise cell, at a random place in it and of a random brightness.
float paintCitySpots(vec3 spotPoint) {
  vec3 spotCell = floor(spotPoint);
  vec3 spotCentre = spotCell + 0.5 + 0.6 * (vec3(hashPoint(spotCell), hashPoint(spotCell + 3.1), hashPoint(spotCell + 7.7)) - 0.5);
  vec3 fromSpot = spotPoint - spotCentre;
  return pow(hashPoint(spotCell + 11.3), 2.0) * exp(-dot(fromSpot, fromSpot) * citySpotSharpness);
}

float measureCityLights(vec3 planetPoint, float elevation) {
  float clusterShare = smoothstep(0.55, 0.8, sampleSlopedNoise(planetPoint * cityClusterFrequency).x);
  if (clusterShare <= 0.0 || elevation <= 0.0) return 0.0;
  float lowlandShare = smoothstep(0.14, 0.0, elevation);
  return clusterShare * lowlandShare * (2.0 * paintCitySpots(planetPoint * cityTownFrequency) + paintCitySpots(planetPoint * cityStreetFrequency) + 0.3 * pow(sampleSlopedNoise(planetPoint * cityClusterFrequency * 3.0).x, 4.0))

    * smoothstep(0.0, coastSharpness, elevation);
}

vec3 paintSurface(vec3 groundPoint, vec3 rayOrigin, vec3 rayDirection, vec3 sunDirection, vec3 lightDirection) {
  vec3 groundNormal = normalize(groundPoint - planetCentre);
  float spinAngle = elapsedSeconds * planetSpinSpeed;
  vec3 planetPoint = rotateAroundAxis(groundNormal, planetPoleAxis, spinAngle);
  vec4 terrainSample = shapeTerrain(planetPoint);
  float elevation = terrainSample.x;
  float landShare = smoothstep(0.0, coastSharpness, elevation);
  vec3 groundAlbedo = colorGround(planetPoint, elevation);
  float mountainShare = 0.3 + smoothstep(0.0, 0.15, elevation);
  vec3 reliefNormal = rotateAroundAxis(bendNormal(planetPoint, terrainSample.yzw, reliefStrength * landShare * mountainShare), planetPoleAxis, -spinAngle);

  vec3 cloudPoint = rayOrigin + rayDirection * intersectSphere(rayOrigin, rayDirection, cloudShellRadius).x;
  vec3 cloudNormal = normalize(cloudPoint - planetCentre);
  vec3 cloudSlope;
  float cloudCover = measureCloudCover(rotateAroundAxis(cloudNormal, planetPoleAxis, spinAngle), cloudOctaveCount, cloudSlope);
  vec3 cloudReliefNormal = rotateAroundAxis(bendNormal(rotateAroundAxis(cloudNormal, planetPoleAxis, spinAngle), cloudSlope, cloudReliefStrength), planetPoleAxis, -spinAngle);

  float sunFacing = dot(groundNormal, lightDirection);
  float viewFacing = max(dot(groundNormal, -rayDirection), grazingFloor);
  float daylightShare = smoothstep(-0.15, 0.3, sunFacing);
  vec3 groundColor = groundAlbedo * skyFillColor * daylightShare;
  vec3 cloudColor = cloudAlbedo * skyFillColor * daylightShare;
  if (sunFacing > -0.15) {
    vec3 groundSunlight = sunIntensity * measureSunTransmittance(groundPoint + groundNormal * earthShadowSoftness, lightDirection);
    vec3 cloudSunlight = sunIntensity * measureSunTransmittance(cloudPoint, lightDirection);
    vec3 shadowNormal = normalize(groundNormal + lightDirection * (cloudShellRadius - planetRadius) / max(sunFacing, cloudShadowFacingFloor));
    vec3 ignoredSlope;
    float cloudShadow = 1.0 - cloudShadowDepth * measureCloudCover(rotateAroundAxis(shadowNormal, planetPoleAxis, spinAngle), cloudShadowOctaveCount, ignoredSlope);
    groundColor += groundAlbedo / circleConstant * groundSunlight * max(dot(reliefNormal, lightDirection), 0.0) * cloudShadow;
    vec3 halfwayDirection = normalize(lightDirection - rayDirection);
    float roughnessSquare = oceanRoughness * oceanRoughness * oceanRoughness * oceanRoughness;
    float halfwayFacing = max(dot(groundNormal, halfwayDirection), 0.0);
    float glintSpread = roughnessSquare / (circleConstant * pow(halfwayFacing * halfwayFacing * (roughnessSquare - 1.0) + 1.0, 2.0));
    float glintFresnel = oceanReflectance + (1.0 - oceanReflectance) * pow(1.0 - max(dot(halfwayDirection, -rayDirection), 0.0), 5.0);
    float skyFresnel = oceanReflectance + (1.0 - oceanReflectance) * pow(1.0 - viewFacing, 5.0);
    vec3 oceanShine = groundSunlight * glintSpread * glintFresnel * smoothstep(0.0, 0.15, sunFacing) / (4.0 * viewFacing)
 * cloudShadow + skyFillColor * 4.0 * skyFresnel * daylightShare;
    groundColor += oceanShine * (1.0 - landShare);
    float cloudLambert = clamp((dot(cloudReliefNormal, lightDirection) + cloudWrapLight) / (1.0 + cloudWrapLight), 0.0, 1.0);
    float silverLining = pow(max(dot(rayDirection, sunDirection), 0.0), 12.0) * (1.0 - cloudCover);
    cloudColor += cloudAlbedo / circleConstant * cloudSunlight * (cloudLambert + 2.0 * silverLining);
  }
  if (sunFacing < 0.15) {
    float nightShare = smoothstep(0.1, -0.1, sunFacing);
    float cityLight = measureCityLights(planetPoint, elevation) * cityLightIntensity;
    float moonFacing = max(dot(reliefNormal, moonDirection), 0.0);
    groundColor += nightShare * (cityLightColor * cityLight * (1.0 - 0.7 * cloudCover) + groundAlbedo * moonTint * moonIntensity * moonFacing);
    float cloudMoonFacing = clamp((dot(cloudReliefNormal, moonDirection) + cloudWrapLight) / (1.0 + cloudWrapLight), 0.0, 1.0);
    cloudColor += nightShare * (cloudAlbedo * moonTint * moonIntensity * cloudMoonFacing + cityLightColor * cityLight * 0.25);
  }
  return mix(groundColor, cloudColor, cloudCover);
}

vec3 paintSky(vec3 rayOrigin, vec3 rayDirection, vec3 sunDirection, vec3 lightDirection) {
  vec2 skyPoint = rayDirection.xy / rayDirection.z;
  vec2 starPoint = skyPoint * 260.0;
  vec2 starCell = floor(starPoint);
  float starChance = hashPoint(vec3(starCell, 7.0));
  vec2 starOffset = vec2(hashPoint(vec3(starCell, 11.0)), hashPoint(vec3(starCell, 13.0))) - 0.5;
  float starDistance = length(fract(starPoint) - 0.5 - 0.6 * starOffset);
  float starBrightness = pow(smoothstep(0.965, 1.0, starChance), 3.0) * 4.0;
  float starTwinkle = 0.8 + 0.2 * sin(elapsedSeconds * 2.0 + starChance * 40.0);
  vec3 starColor = mix(vec3(0.65, 0.78, 1.0), vec3(1.0, 0.82, 0.6), starOffset.x + 0.5);
  vec3 skyColor = starColor * starBrightness * starTwinkle * exp(-starDistance * starDistance * 90.0);
  float bandShare = smoothstep(0.45, 0.0, abs(skyPoint.y * 1.6 - skyPoint.x + 0.25));
  float milkyGlow = smoothstep(-0.15, 0.3, sumFractalSlope(vec3(skyPoint * 3.0, 3.0), 5, 0.0, terrainOctaveGain).x);
  float dustLanes = smoothstep(-0.05, 0.12, sumFractalSlope(vec3(skyPoint * 7.0, 9.0), 3, 0.0, terrainOctaveGain).x);
  skyColor += vec3(0.05, 0.035, 0.09) * bandShare * milkyGlow * (1.0 - 0.7 * dustLanes);
  float sunCosine = dot(rayDirection, sunDirection);
  float discRadiusSquare = clamp((1.0 - sunCosine) / (1.0 - sunDiscCosine), 0.0, 1.0);
  float discShare = smoothstep(sunDiscCosine - sunDiscEdge, sunDiscCosine + sunDiscEdge, sunCosine);
  skyColor += sunDiscRadiance * (1.0 - limbDarkening * (1.0 - sqrt(1.0 - discRadiusSquare))) * discShare;
  vec3 fromCentre = rayOrigin - planetCentre;
  vec3 closestPoint = fromCentre - rayDirection * dot(fromCentre, rayDirection);
  float closestAltitude = length(closestPoint) - planetRadius;
  float limbNightShare = smoothstep(0.1, -0.2, dot(normalize(closestPoint), lightDirection));
  skyColor += airglowColor * airglowIntensity * limbNightShare * exp(-pow((closestAltitude - airglowAltitude) / airglowThickness, 2.0));
  return skyColor;
}

// Lens glare in screen space: bloom of three widths, thin rays, an anamorphic streak and coloured ghosts.
vec3 paintGlare(vec2 screenPoint, vec2 sunScreenPoint, vec3 glareColor) {
  vec2 fromSun = screenPoint - sunScreenPoint;
  float sunDistance = length(fromSun);
  vec2 rayHeading = fromSun / max(sunDistance, 0.0001);
  float bloomLight = exp(-sunDistance * 45.0) * 1.5 + 0.006 / (sunDistance + 0.006) + exp(-sunDistance * 3.5) * 0.25;

  float wideRays = pow(sampleSlopedNoise(vec3(rayHeading * 6.0, elapsedSeconds * 0.1)).x, 5.0);
  float fineRays = pow(sampleSlopedNoise(vec3(rayHeading * 24.0, 5.0 + elapsedSeconds * 0.05)).x, 8.0);
  float rayLight = (wideRays * 0.35 + fineRays * 0.3) * exp(-sunDistance * 7.0);

  float streakLight = exp(-abs(fromSun.y) * 160.0) * exp(-abs(fromSun.x) * 1.6) * 0.8;
  vec3 ghostLight = vec3(0.0);
  for (int ghostIndex = 0; ghostIndex < 4; ghostIndex++) {
    float ghostRadius = 0.025 + 0.02 * float(ghostIndex);
    float ghostDistance = length(screenPoint - sunScreenPoint * ghostPositions[ghostIndex]);
    float ghostShape = smoothstep(ghostRadius, ghostRadius * 0.6, ghostDistance) * 0.3 + smoothstep(0.008, 0.0, abs(ghostDistance - ghostRadius));
    ghostLight += mix(vec3(0.3, 0.6, 1.0), vec3(1.0, 0.5, 0.35), float(ghostIndex) / 3.0) * ghostShape * 0.02;
  }
  return glareColor * (bloomLight + rayLight + ghostLight) + streakBlue * streakLight * dot(glareColor, vec3(0.33));
}

vec3 mapTones(vec3 linearColor) {
  vec3 acesColor = acesInputMatrix * linearColor;
  acesColor = (acesColor * (acesColor + 0.0245786) - 0.000090537) / (acesColor * (0.983729 * acesColor + 0.432951) + 0.238081);
  return pow(clamp(acesOutputMatrix * acesColor, 0.0, 1.0), vec3(1.0 / 2.2));
}

void main() {
  vec2 screenPoint = (gl_FragCoord.xy - 0.5 * viewportSize) / viewportSize.y;
  vec3 rayOrigin = vec3(pointerOffset * cameraParallax, 0.0);
  mat2 rollMatrix = mat2(cos(cameraRoll), sin(cameraRoll), -sin(cameraRoll), cos(cameraRoll));
  vec3 rayDirection = normalize(vec3(rollMatrix * screenPoint, focalLength));
  vec3 sunDirection = normalize(mix(hiddenSunDirection, risenSunDirection, sunriseShare));
  vec3 lightDirection = normalize(sunDirection + lightLeanTowardCamera * sunriseShare);
  vec2 sunScreenPoint = sunDirection.xy / sunDirection.z * focalLength * rollMatrix;

  float sunVisibility = smoothstep(-0.004, 0.01, measureRayAltitude(rayOrigin, sunDirection));
  float pixelJitter = hashPoint(vec3(gl_FragCoord.xy, fract(elapsedSeconds) * 61.0));

  vec2 planetHit = intersectSphere(rayOrigin, rayDirection, planetRadius);
  vec2 atmosphereHit = intersectSphere(rayOrigin, rayDirection, atmosphereRadius);
  bool hitsPlanet = planetHit.x > 0.0;
  vec3 viewTransmittance = vec3(1.0);
  vec3 sceneColor = vec3(0.0);
  if (atmosphereHit.y > 0.0) {
    vec2 pathRange = vec2(max(atmosphereHit.x, 0.0), hitsPlanet ? planetHit.x : atmosphereHit.y);
    sceneColor = scatterSunlight(rayOrigin, rayDirection, pathRange, hitsPlanet, sunDirection, lightDirection, pixelJitter, viewTransmittance);
  }
  vec3 surfaceColor = hitsPlanet ? paintSurface(rayOrigin + rayDirection * planetHit.x, rayOrigin, rayDirection, sunDirection, lightDirection) : paintSky(rayOrigin, rayDirection, sunDirection, lightDirection);

  sceneColor += surfaceColor * viewTransmittance;
  vec3 glareColor = mix(dawnGlowColor * 0.25 * sunriseShare, measureSunColor(rayOrigin, sunDirection), sunVisibility);
  sceneColor += paintGlare(screenPoint, sunScreenPoint, glareColor);
  float exposureScale = mix(nightExposure, dayExposure, sunVisibility) * (1.0 - vignetteStrength * dot(screenPoint, screenPoint));
  float filmGrain = (hashPoint(vec3(gl_FragCoord.xy, elapsedSeconds * 60.0 + 3.0)) - 0.5) * grainStrength;
  fragmentColor = vec4(mapTones(sceneColor * exposureScale) + filmGrain, 1.0);
}
`;

function compileShader(renderingContext: WebGL2RenderingContext, shaderKind: number, shaderSource: string): WebGLShader | undefined {
  const compiledShader = renderingContext.createShader(shaderKind);
  if (compiledShader === null) return undefined;
  renderingContext.shaderSource(compiledShader, shaderSource);
  renderingContext.compileShader(compiledShader);
  return renderingContext.getShaderParameter(compiledShader, renderingContext.COMPILE_STATUS) ? compiledShader : undefined;
}

// On screen the drawing buffer follows the displayed size, but never grows past the slide's own pixels; a still copy takes them all, for print.
function measureCanvasPixels(canvasElement: HTMLElement, followsScreen: boolean, qualityShare = 1): PixelSize {
  const layoutWidth = Math.max(1, canvasElement.offsetWidth);
  const layoutHeight = Math.max(1, canvasElement.offsetHeight);
  const displayScale = canvasElement.getBoundingClientRect().width / layoutWidth;
  const pixelShare = followsScreen ? Math.min(1, displayScale * window.devicePixelRatio) * qualityShare : 1;
  return { pixelWidth: Math.max(1, Math.round(layoutWidth * pixelShare)), pixelHeight: Math.max(1, Math.round(layoutHeight * pixelShare)) };
}

// A context the browser has taken away, or a shader the GPU refused, leaves the canvas empty instead of breaking the slide.
function createShaderPainter(paintedCanvas: HTMLCanvasElement): ShaderPainter | undefined {
  const renderingContext = paintedCanvas.getContext("webgl2", { antialias: false });
  if (renderingContext === null || renderingContext.isContextLost()) return undefined;
  const vertexShader = compileShader(renderingContext, renderingContext.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(renderingContext, renderingContext.FRAGMENT_SHADER, fragmentShaderSource);
  if (vertexShader === undefined || fragmentShader === undefined) return undefined;
  const shaderProgram = renderingContext.createProgram();
  renderingContext.attachShader(shaderProgram, vertexShader);
  renderingContext.attachShader(shaderProgram, fragmentShader);
  renderingContext.linkProgram(shaderProgram);
  if (!renderingContext.getProgramParameter(shaderProgram, renderingContext.LINK_STATUS)) return undefined;
  renderingContext.useProgram(shaderProgram);
  renderingContext.bindBuffer(renderingContext.ARRAY_BUFFER, renderingContext.createBuffer());
  renderingContext.bufferData(renderingContext.ARRAY_BUFFER, fullScreenTriangle, renderingContext.STATIC_DRAW);
  const cornerLocation = renderingContext.getAttribLocation(shaderProgram, "screenCorner");
  renderingContext.enableVertexAttribArray(cornerLocation);
  renderingContext.vertexAttribPointer(cornerLocation, vertexComponentCount, renderingContext.FLOAT, false, 0, 0);
  const locateUniform = (uniformName: string) => renderingContext.getUniformLocation(shaderProgram, uniformName);
  const [viewportLocation, elapsedLocation, sunriseLocation, pointerLocation] = ["viewportSize", "elapsedSeconds", "sunriseShare", "pointerOffset"].map(locateUniform);

  return {
    paintedCanvas,
    paintFrame({ pixelWidth, pixelHeight }, sunriseShare, elapsedSeconds, pointerX, pointerY) {
      if (paintedCanvas.width !== pixelWidth) paintedCanvas.width = pixelWidth;
      if (paintedCanvas.height !== pixelHeight) paintedCanvas.height = pixelHeight;
      renderingContext.viewport(0, 0, pixelWidth, pixelHeight);
      renderingContext.uniform2f(viewportLocation!, pixelWidth, pixelHeight);
      renderingContext.uniform1f(elapsedLocation!, elapsedSeconds);
      renderingContext.uniform1f(sunriseLocation!, sunriseShare);
      renderingContext.uniform2f(pointerLocation!, pointerX, pointerY);
      renderingContext.drawArrays(renderingContext.TRIANGLES, 0, triangleVertexCount);
    },
    isPainterLost: () => renderingContext.isContextLost(),
    releasePainter() {
      renderingContext.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

// Thumbnails, printed pages and reduced motion get a JPEG from one shared hidden WebGL canvas. The browser keeps only a few
// WebGL contexts and drops the oldest when 3D scenes print beside this slide; a canvas, even opaque, prints with a soft mask.
function paintStillPicture(pictureElement: HTMLImageElement) {
  const pixelSize = measureCanvasPixels(pictureElement, false);
  const sizeKey = `${pixelSize.pixelWidth}x${pixelSize.pixelHeight}`;
  if (!stillPictureAddresses.has(sizeKey)) {
    if (stillPicturePainter === undefined || stillPicturePainter.isPainterLost()) stillPicturePainter = createShaderPainter(document.createElement("canvas"));
    if (stillPicturePainter === undefined) return;
    stillPicturePainter.paintFrame(pixelSize, settledSunriseShare, stillFrameSeconds, 0, 0);
    stillPictureAddresses.set(sizeKey, stillPicturePainter.paintedCanvas.toDataURL(stillPictureFormat, stillPictureQuality));
  }
  pictureElement.src = stillPictureAddresses.get(sizeKey)!;
}

function easeSunrise(timeShare: number): number {
  const clampedShare = Math.min(settledSunriseShare, timeShare);
  return 1 - (1 - clampedShare) ** 3;
}

function StillSunrise() {
  const pictureReference = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => paintStillPicture(pictureReference.current!), []);
  return <img ref={pictureReference} alt="" className="absolute inset-0 size-full" />;
}

// The sunrise plays once on entering the slide, the camera follows the mouse.
// Each run of the effect paints on a canvas of its own: a released WebGL context never comes back,
// and React in development runs the effect twice on one element.
function LiveSunrise() {
  const stageReference = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const canvasElement = document.createElement("canvas");
    canvasElement.className = "absolute inset-0 size-full";
    stageReference.current!.append(canvasElement);
    const shaderPainter = createShaderPainter(canvasElement);
    if (shaderPainter === undefined) return () => canvasElement.remove();
    const startTime = performance.now();
    const pointerTarget = { pointerX: 0, pointerY: 0 };
    const smoothedPointer = { pointerX: 0, pointerY: 0 };
    let animationFrameRequest = 0;
    let qualityShare = 1;
    let slowFrameStreak = 0;
    let previousFrameTime = startTime;
    const followPointer = (pointerEvent: PointerEvent) => {
      pointerTarget.pointerX = pointerEvent.clientX / window.innerWidth - halfWindowShare;
      pointerTarget.pointerY = halfWindowShare - pointerEvent.clientY / window.innerHeight;
    };
    // A GPU that cannot keep up for half a second in a row gets fewer pixels; the browser stretches the canvas back.
    const paintNextFrame = () => {
      const frameTime = performance.now();
      slowFrameStreak = frameTime - previousFrameTime > slowFrameMilliseconds ? slowFrameStreak + 1 : 0;
      previousFrameTime = frameTime;
      if (slowFrameStreak >= slowFrameStreakLimit && qualityShare > smallestPixelShare) {
        qualityShare *= pixelShareReduction;
        slowFrameStreak = 0;
      }
      const elapsedSeconds = (frameTime - startTime) / millisecondsPerSecond;
      smoothedPointer.pointerX += (pointerTarget.pointerX - smoothedPointer.pointerX) * pointerFollowShare;
      smoothedPointer.pointerY += (pointerTarget.pointerY - smoothedPointer.pointerY) * pointerFollowShare;
      const sunriseShare = easeSunrise(elapsedSeconds / sunriseSeconds);
      shaderPainter.paintFrame(measureCanvasPixels(canvasElement, true, qualityShare), sunriseShare,
 elapsedSeconds, smoothedPointer.pointerX, smoothedPointer.pointerY);
      animationFrameRequest = requestAnimationFrame(paintNextFrame);
    };
    window.addEventListener("pointermove", followPointer);
    paintNextFrame();
    return () => {
      cancelAnimationFrame(animationFrameRequest);
      window.removeEventListener("pointermove", followPointer);
      shaderPainter.releasePainter();
      canvasElement.remove();
    };
  }, []);
  return <div ref={stageReference} aria-hidden className="contents" />;
}

// Copies and reduced motion show one still frame of the risen sun. A slide that is neither on screen nor a copy draws nothing and holds no WebGL context.
export function OrbitSunrise() {
  const { isCurrent, isCopy } = Machina.useSlide();
  if (isCopy || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return <StillSunrise />;
  return isCurrent ? <LiveSunrise /> : null;
}
