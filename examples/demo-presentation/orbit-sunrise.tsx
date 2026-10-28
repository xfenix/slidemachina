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
const stillPictureQuality = 0.9;

let stillPicturePainter: ShaderPainter | undefined;
const stillPictureAddresses = new Map<string, string>();

const vertexShaderSource = `#version 300 es
in vec2 screenCorner;
void main() { gl_Position = vec4(screenCorner, 0.0, 1.0); }
`;

// The Earth from orbit at sunrise: the planet is a ray-traced sphere with noise continents, clouds and city lights,
// the atmosphere is a thin glow over the limb, the glare is drawn in screen space around the sun. No textures.
const fragmentShaderSource = `#version 300 es
precision highp float;
uniform vec2 viewportSize;
uniform float elapsedSeconds;
uniform float sunriseShare;
uniform vec2 pointerOffset;
out vec4 fragmentColor;

const float focalLength = 1.6;
const float planetRadius = 1.0;
const vec3 planetCentre = vec3(0.0, -1.056, 0.759);
const float atmosphereScaleHeight = 0.011;
const float planetSpinSpeed = 0.01;
const float cloudDriftSpeed = 0.006;
const vec3 hiddenSunDirection = vec3(0.2, -0.13, 1.0);
const vec3 risenSunDirection = vec3(0.2, -0.045, 1.0);
const float cameraParallax = 0.035;
const vec3 oceanColor = vec3(0.004, 0.018, 0.06);
const vec3 landColor = vec3(0.035, 0.05, 0.03);
const vec3 nightOceanColor = vec3(0.006, 0.016, 0.05);
const vec3 cityLightColor = vec3(1.0, 0.62, 0.3);
const vec3 skyBlue = vec3(0.18, 0.45, 1.0);
const vec3 sunsetOrange = vec3(1.0, 0.42, 0.12);
const vec3 sunWhite = vec3(1.0, 0.93, 0.82);
const vec3 streakBlue = vec3(0.45, 0.65, 1.0);

float hashPoint(vec3 samplePoint) {
  samplePoint = fract(samplePoint * 0.3183099 + 0.1);
  samplePoint *= 17.0;
  return fract(samplePoint.x * samplePoint.y * samplePoint.z * (samplePoint.x + samplePoint.y + samplePoint.z));
}

float valueNoise(vec3 samplePoint) {
  vec3 cellCorner = floor(samplePoint);
  vec3 cellShare = fract(samplePoint);
  cellShare = cellShare * cellShare * (3.0 - 2.0 * cellShare);
  return mix(
    mix(mix(hashPoint(cellCorner), hashPoint(cellCorner + vec3(1, 0, 0)), cellShare.x),
        mix(hashPoint(cellCorner + vec3(0, 1, 0)), hashPoint(cellCorner + vec3(1, 1, 0)), cellShare.x), cellShare.y),
    mix(mix(hashPoint(cellCorner + vec3(0, 0, 1)), hashPoint(cellCorner + vec3(1, 0, 1)), cellShare.x),
        mix(hashPoint(cellCorner + vec3(0, 1, 1)), hashPoint(cellCorner + vec3(1, 1, 1)), cellShare.x), cellShare.y),
    cellShare.z);
}

float fractalNoise(vec3 samplePoint, int octaveCount) {
  float noiseTotal = 0.0;
  float octaveWeight = 0.5;
  for (int octaveIndex = 0; octaveIndex < 6; octaveIndex++) {
    if (octaveIndex >= octaveCount) break;
    noiseTotal += octaveWeight * valueNoise(samplePoint);
    samplePoint = samplePoint * 2.03 + vec3(1.7, 9.2, 3.1);
    octaveWeight *= 0.5;
  }
  return noiseTotal;
}

vec3 spinAroundAxis(vec3 surfacePoint, float spinAngle) {
  float spinCosine = cos(spinAngle);
  float spinSine = sin(spinAngle);
  return vec3(spinCosine * surfacePoint.x + spinSine * surfacePoint.z, surfacePoint.y, -spinSine * surfacePoint.x + spinCosine * surfacePoint.z);
}

// Height of the ray above the planet at its closest point: negative inside the sphere.
float measureRayAltitude(vec3 rayOrigin, vec3 rayDirection) {
  vec3 fromCentre = rayOrigin - planetCentre;
  vec3 closestPoint = fromCentre - rayDirection * dot(fromCentre, rayDirection);
  return length(closestPoint) - planetRadius;
}

vec3 paintAtmosphere(float rayAltitude, float sunCloseness) {
  float glowDensity = exp(-max(rayAltitude, 0.0) / atmosphereScaleHeight);
  vec3 glowColor = mix(sunsetOrange, skyBlue, smoothstep(0.0, 0.018, rayAltitude));
  float sunLight = 0.18 + 2.6 * pow(sunCloseness, 6.0) + 6.0 * pow(sunCloseness, 60.0);
  return glowColor * glowDensity * sunLight;
}

vec3 paintStars(vec3 rayDirection) {
  vec2 skyPoint = rayDirection.xy / rayDirection.z * 220.0;
  vec2 starCell = floor(skyPoint);
  float starChance = hashPoint(vec3(starCell, 7.0));
  float starDistance = length(fract(skyPoint) - 0.5);
  float starTwinkle = 0.75 + 0.25 * sin(elapsedSeconds * 2.0 + starChance * 40.0);
  float starLight = step(0.985, starChance) * smoothstep(0.18, 0.0, starDistance) * starTwinkle;
  float milkyWay = fractalNoise(vec3(skyPoint * 0.012, 3.0), 4) * smoothstep(0.35, 0.0, abs(rayDirection.y * 1.6 - rayDirection.x + 0.25));
  return vec3(starLight) + vec3(0.12, 0.08, 0.22) * milkyWay * milkyWay;
}

vec3 paintPlanet(vec3 surfacePoint, vec3 rayDirection, vec3 sunDirection) {
  vec3 surfaceNormal = normalize(surfacePoint - planetCentre);
  vec3 spunNormal = spinAroundAxis(surfaceNormal, elapsedSeconds * planetSpinSpeed);
  float continentNoise = fractalNoise(spunNormal * 2.4, 6);
  float landShare = smoothstep(0.49, 0.52, continentNoise);
  float cloudShare = smoothstep(0.5, 0.78, fractalNoise(spinAroundAxis(spunNormal, elapsedSeconds * cloudDriftSpeed) * 3.6 + 11.0, 5));
  float sunFacing = dot(surfaceNormal, sunDirection);
  float dayLight = clamp(sunFacing * 2.2, 0.0, 1.0);
  float twilightBand = smoothstep(-0.12, 0.0, sunFacing) * smoothstep(0.1, 0.0, sunFacing);
  vec3 dayColor = mix(oceanColor, landColor, landShare);
  dayColor = mix(dayColor, vec3(0.7), cloudShare) * dayLight;
  float cityClusters = smoothstep(0.5, 0.75, valueNoise(spunNormal * 16.0));
  float citySpots = cityClusters * pow(valueNoise(spunNormal * 320.0), 10.0) * 6.0 + cityClusters * pow(valueNoise(spunNormal * 90.0), 6.0) * 0.6;
  vec3 nightColor = (cityLightColor * citySpots * landShare + nightOceanColor * (1.0 - landShare)) * (1.0 - dayLight) * (1.0 - 0.85 * cloudShare);
  vec3 twilightColor = sunsetOrange * twilightBand * (0.04 + 0.4 * cloudShare);
  float oceanGlint = pow(max(dot(reflect(rayDirection, surfaceNormal), sunDirection), 0.0), 80.0) * (1.0 - landShare) * (1.0 - cloudShare);
  float limbShare = pow(1.0 - max(dot(-rayDirection, surfaceNormal), 0.0), 9.0);
  float sunCloseness = max(dot(rayDirection, sunDirection), 0.0);
  vec3 rimGlow = paintAtmosphere(0.006, sunCloseness) * limbShare * 0.5;
  return dayColor + nightColor + twilightColor + sunWhite * oceanGlint * 3.0 + rimGlow;
}

// Lens glare in screen space: a soft halo, thin rays, a horizontal anamorphic streak and two coloured ghosts.
vec3 paintGlare(vec2 screenPoint, vec2 sunScreenPoint, float sunVisibility) {
  vec2 fromSun = screenPoint - sunScreenPoint;
  float sunDistance = length(fromSun);
  float haloLight = 0.012 / (sunDistance + 0.012);
  float rayAngle = atan(fromSun.y, fromSun.x);
  float rayLight = pow(valueNoise(vec3(rayAngle * 9.0, elapsedSeconds * 0.15, 0.0)), 4.0) * exp(-sunDistance * 7.0);
  float streakLight = exp(-abs(fromSun.y) * 140.0) * exp(-abs(fromSun.x) * 1.4);
  vec3 ghostLight = vec3(0.0);
  for (int ghostIndex = 1; ghostIndex <= 2; ghostIndex++) {
    vec2 ghostCentre = -sunScreenPoint * (0.45 * float(ghostIndex));
    float ghostRing = smoothstep(0.02, 0.0, abs(length(screenPoint - ghostCentre) - 0.03 * float(ghostIndex)));
    ghostLight += mix(vec3(0.3, 0.6, 1.0), vec3(1.0, 0.45, 0.6), float(ghostIndex - 1)) * ghostRing * 0.025;
  }
  return (sunWhite * (haloLight * 0.9 + rayLight * 0.45) + streakBlue * streakLight * 0.9 + ghostLight) * sunVisibility;
}

vec3 mapTones(vec3 linearColor) {
  vec3 mappedColor = (linearColor * (2.51 * linearColor + 0.03)) / (linearColor * (2.43 * linearColor + 0.59) + 0.14);
  return pow(clamp(mappedColor, 0.0, 1.0), vec3(1.0 / 2.2));
}

void main() {
  vec2 screenPoint = (gl_FragCoord.xy - 0.5 * viewportSize) / viewportSize.y;
  vec3 rayOrigin = vec3(pointerOffset * cameraParallax, 0.0);
  vec3 rayDirection = normalize(vec3(screenPoint, focalLength));
  vec3 sunDirection = normalize(mix(hiddenSunDirection, risenSunDirection, sunriseShare));
  vec2 sunScreenPoint = sunDirection.xy / sunDirection.z * focalLength;
  float sunAltitude = measureRayAltitude(rayOrigin, sunDirection);
  float sunVisibility = smoothstep(-0.006, 0.012, sunAltitude);

  vec3 fromCentre = rayOrigin - planetCentre;
  float halfChord = dot(fromCentre, rayDirection);
  float hitDiscriminant = halfChord * halfChord - dot(fromCentre, fromCentre) + planetRadius * planetRadius;
  float sunCloseness = max(dot(rayDirection, sunDirection), 0.0);
  vec3 sceneColor;
  if (hitDiscriminant > 0.0) {
    float hitDistance = -halfChord - sqrt(hitDiscriminant);
    sceneColor = paintPlanet(rayOrigin + rayDirection * hitDistance, rayDirection, sunDirection);
  } else {
    float rayAltitude = measureRayAltitude(rayOrigin, rayDirection);
    float sunDisc = smoothstep(0.99996, 0.99999, sunCloseness) * 40.0;
    sceneColor = paintStars(rayDirection) + paintAtmosphere(rayAltitude, sunCloseness) + sunWhite * sunDisc;
  }
  sceneColor += paintGlare(screenPoint, sunScreenPoint, max(sunVisibility, 0.25 * sunriseShare));
  float vignette = 1.0 - 0.35 * dot(screenPoint, screenPoint);
  float filmGrain = (hashPoint(vec3(gl_FragCoord.xy, elapsedSeconds * 60.0)) - 0.5) * 0.035;
  fragmentColor = vec4(mapTones(sceneColor * vignette) + filmGrain, 1.0);
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
function measureCanvasPixels(canvasElement: HTMLElement, followsScreen: boolean): PixelSize {
  const layoutWidth = Math.max(1, canvasElement.offsetWidth);
  const layoutHeight = Math.max(1, canvasElement.offsetHeight);
  const displayScale = canvasElement.getBoundingClientRect().width / layoutWidth;
  const pixelShare = followsScreen ? Math.min(1, displayScale * window.devicePixelRatio) : 1;
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
function LiveSunrise() {
  const canvasReference = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvasElement = canvasReference.current!;
    const shaderPainter = createShaderPainter(canvasElement);
    if (shaderPainter === undefined) return;
    const startTime = performance.now();
    const pointerTarget = { pointerX: 0, pointerY: 0 };
    const smoothedPointer = { pointerX: 0, pointerY: 0 };
    let animationFrameRequest = 0;
    const followPointer = (pointerEvent: PointerEvent) => {
      pointerTarget.pointerX = pointerEvent.clientX / window.innerWidth - halfWindowShare;
      pointerTarget.pointerY = halfWindowShare - pointerEvent.clientY / window.innerHeight;
    };
    const paintNextFrame = () => {
      const elapsedSeconds = (performance.now() - startTime) / millisecondsPerSecond;
      smoothedPointer.pointerX += (pointerTarget.pointerX - smoothedPointer.pointerX) * pointerFollowShare;
      smoothedPointer.pointerY += (pointerTarget.pointerY - smoothedPointer.pointerY) * pointerFollowShare;
      const sunriseShare = easeSunrise(elapsedSeconds / sunriseSeconds);
      shaderPainter.paintFrame(measureCanvasPixels(canvasElement, true), sunriseShare, elapsedSeconds, smoothedPointer.pointerX, smoothedPointer.pointerY);
      animationFrameRequest = requestAnimationFrame(paintNextFrame);
    };
    window.addEventListener("pointermove", followPointer);
    paintNextFrame();
    return () => {
      cancelAnimationFrame(animationFrameRequest);
      window.removeEventListener("pointermove", followPointer);
      shaderPainter.releasePainter();
    };
  }, []);
  return <canvas ref={canvasReference} aria-hidden className="absolute inset-0 size-full" />;
}

// Copies and reduced motion show one still frame of the risen sun. A slide that is neither on screen nor a copy draws nothing and holds no WebGL context.
export function OrbitSunrise() {
  const { isCurrent, isCopy } = Machina.useSlide();
  if (isCopy || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return <StillSunrise />;
  return isCurrent ? <LiveSunrise /> : null;
}
