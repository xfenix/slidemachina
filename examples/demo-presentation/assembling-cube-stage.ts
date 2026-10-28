// The three.js part of the cube slide: a module of its own, loaded on demand, so three.js stays out of the main bundle.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  Raycaster,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  VSMShadowMap,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type PixelSize = { pixelWidth: number; pixelHeight: number };
type PieceMotion = {
  homePosition: Vector3;
  scatteredPosition: Vector3;
  spinAxis: Vector3;
  spinAngle: number;
  startDelayShare: number;
  morphTargetIndex: number;
  driftPhase: number;
};
type SpringState = { springPosition: Vector3; springVelocity: Vector3 };
type CubeStage = {
  paintMoment: (pixelSize: PixelSize, elapsedSeconds: number, stepSeconds: number) => void;
  aimPointer: (pointerPlace: Vector2 | undefined) => void;
  strikeAt: (pointerPlace: Vector2) => void;
  releaseStage: () => void;
};

const piecesPerEdge = 3;
const pieceSpacing = 1;
const cubeInradius = 0.45;
const sphereRadius = 0.5;
const tetrahedronInradius = 0.22;
const octahedronInradius = 0.34;
const faceRoundness = 9;
const pieceSegments = 16;
const keepsCubeShape = -1;
const morphTargetCount = 3;
const smallShapeScale = 0.7;
const scatterSpread = 1.6;
const scatterJitter = 0.4;
const swirlAngle = 0.8;
const driftAmplitude = 0.12;
const driftSpeed = 0.8;
const driftSpeedRatioY = 1.3;
const driftSpeedRatioZ = 0.7;
const spinSpeed = 0.45;
const fullTurn = Math.PI * 2;
const layerDelayShare = 0.22;
const randomDelayShare = 0.16;
const largestStartDelayShare = layerDelayShare + randomDelayShare;
const cycleSeconds = 14;
const explodeStartSeconds = 2.2;
const explodeSeconds = 2.6;
const morphStartSeconds = 3.8;
const morphSeconds = 2;
const morphBackStartSeconds = 8.4;
const reassembleStartSeconds = 9.6;
const reassembleSeconds = 2.8;
const turnSpeed = 0.3;
const restingYaw = Math.PI / 4;
const restingTilt = 0.52;
const tiltSwing = 0.16;
const tiltSpeed = 0.37;
const rollSwing = 0.12;
const rollSpeed = 0.23;
const orbitRadius = 0.28;
const orbitSpeed = 0.21;
const bobAmplitude = 0.16;
const bobSpeed = 0.55;
const floorDepth = -3.4;
const floorRadius = 9;
const floorSegments = 64;
const floorShadowOpacity = 0.16;
const cameraFieldOfView = 26;
const cameraDistance = 15.5;
const cameraHeight = 1.6;
const cameraNear = 0.1;
const cameraFar = 100;
const sceneShiftShare = 0.2;
const keyLightIntensity = 2.2;
const keyLightPosition = new Vector3(-3, 10, 6);
const shadowMapSize = 1024;
const shadowReach = 7;
const shadowNear = 1;
const shadowFar = 30;
const shadowBlurRadius = 18;
const shadowBlurSamples = 16;
const environmentBlur = 0.04;
const pieceRoughness = 0.32;
const pieceClearcoat = 1;
const pieceClearcoatRoughness = 0.14;
const gradientStartColor = "#7000d1";
const gradientEndColor = "#007a33";
const gradientReach = 2.4;
const gradientTilt = 0.6;
const backgroundColor = "#ffffff";
const pseudoRandomMultiplier = 12.9898;
const pseudoRandomScale = 43758.5453;
const millisecondsPerSecond = 1000;
const stillMomentSeconds = 3.4;
const stillPictureFormat = "image/jpeg";
const stillPictureQuality = 0.9;
const longestStepSeconds = 0.05;
const pointerSpringStiffness = 38;
const pointerSpringDamping = 10;
const pieceSpringStiffness = 60;
const pieceSpringDamping = 7;
const cameraParallaxWidth = 0.7;
const cameraParallaxHeight = 0.45;
const pointerTiltAngle = 0.2;
const repelRadius = 1.6;
const repelDistance = 1.2;
const strikeImpulse = 12;
const strikeReach = 3;
const spinKickSpeed = 2.4;
const spinFriction = 1.4;
const touchHoldMilliseconds = 450;

const stillPictureAddresses = new Map<string, string>();

function measurePseudoRandom(randomSeed: number): number {
  const scaledSine = Math.sin(randomSeed * pseudoRandomMultiplier) * pseudoRandomScale;
  return scaledSine - Math.floor(scaledSine);
}

function pickRandomDirection(randomSeed: number): Vector3 {
  const heightShare = measurePseudoRandom(randomSeed) * 2 - 1;
  const aroundAngle = measurePseudoRandom(randomSeed + 1) * fullTurn;
  const ringRadius = Math.sqrt(1 - heightShare * heightShare);
  return new Vector3(ringRadius * Math.cos(aroundAngle), heightShare, ringRadius * Math.sin(aroundAngle));
}

function createSpringState(): SpringState {
  return { springPosition: new Vector3(), springVelocity: new Vector3() };
}

const springPull = new Vector3();

// Semi-implicit Euler: a little under critical damping, so motion overshoots once and settles, as a physical object would.
function advanceSpring({ springPosition, springVelocity }: SpringState, restPosition: Vector3, stiffness: number, damping: number, stepSeconds: number) {
  springPull.subVectors(restPosition, springPosition).multiplyScalar(stiffness).addScaledVector(springVelocity, -damping);
  springVelocity.addScaledVector(springPull, stepSeconds);
  springPosition.addScaledVector(springVelocity, stepSeconds);
}

function easeInOutCubic(timeShare: number): number {
  return timeShare < 0.5 ? 4 * timeShare ** 3 : 1 - (2 - 2 * timeShare) ** 3 / 2;
}

function easeInOutQuint(timeShare: number): number {
  return timeShare < 0.5 ? 16 * timeShare ** 5 : 1 - (2 - 2 * timeShare) ** 5 / 2;
}

// Each piece starts its part of a phase a little later than the one before, so the cube comes apart in a wave.
function measurePieceShare(cycleMoment: number, startSeconds: number, durationSeconds: number, startDelayShare: number): number {
  const phaseShare = (cycleMoment - startSeconds) / durationSeconds;
  return Math.min(1, Math.max(0, (phaseShare - startDelayShare) / (1 - largestStartDelayShare)));
}

// A rounded solid seen from its centre: the distance to its surface along each direction. No face normals make a sphere.
function shapeRoundedSolid(surfaceDirections: Vector3[], faceNormals: Vector3[], solidInradius: number): Float32Array {
  const solidPositions = new Float32Array(surfaceDirections.length * 3);
  surfaceDirections.forEach((surfaceDirection, vertexIndex) => {
    const facingSum = faceNormals.reduce((runningSum, faceNormal) => runningSum + Math.max(0, surfaceDirection.dot(faceNormal)) ** faceRoundness, 0);
    const surfaceDistance = faceNormals.length === 0 ? solidInradius : solidInradius / facingSum ** (1 / faceRoundness);
    surfaceDirection.clone().multiplyScalar(surfaceDistance).toArray(solidPositions, vertexIndex * 3);
  });
  return solidPositions;
}

function measureSmoothNormals(solidPositions: Float32Array, vertexOrder: BufferAttribute): BufferAttribute {
  const normalGeometry = new BufferGeometry();
  normalGeometry.setAttribute("position", new BufferAttribute(solidPositions, 3));
  normalGeometry.setIndex(vertexOrder);
  normalGeometry.computeVertexNormals();
  return normalGeometry.getAttribute("normal") as BufferAttribute;
}

// One mesh, four bodies: a rounded cube that morphs into a sphere, a tetrahedron or an octahedron.
function buildMorphingPieceGeometry(): BufferGeometry {
  const subdividedBox = new BoxGeometry(1, 1, 1, pieceSegments, pieceSegments, pieceSegments);
  subdividedBox.deleteAttribute("normal");
  subdividedBox.deleteAttribute("uv");
  const pieceGeometry = mergeVertices(subdividedBox);
  subdividedBox.dispose();
  const boxPositions = pieceGeometry.getAttribute("position");
  const surfaceDirections = Array.from({ length: boxPositions.count }, (_, vertexIndex) => new Vector3().fromBufferAttribute(boxPositions, vertexIndex).normalize());
  const vertexOrder = pieceGeometry.getIndex()!;
  const cubeNormals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((axisValues) => new Vector3(...axisValues));
  const tetrahedronNormals = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((axisValues) => new Vector3(...axisValues).normalize());
  const octahedronNormals = [-1, 1].flatMap((signX) => [-1, 1].flatMap((signY) => [-1, 1].map((signZ) => new Vector3(signX, signY, signZ).normalize())));
  const cubePositions = shapeRoundedSolid(surfaceDirections, cubeNormals, cubeInradius);
  const morphTargetPositions = [
    shapeRoundedSolid(surfaceDirections, [], sphereRadius),
    shapeRoundedSolid(surfaceDirections, tetrahedronNormals, tetrahedronInradius),
    shapeRoundedSolid(surfaceDirections, octahedronNormals, octahedronInradius),
  ];
  pieceGeometry.setAttribute("position", new BufferAttribute(cubePositions, 3));
  pieceGeometry.setAttribute("normal", measureSmoothNormals(cubePositions, vertexOrder));
  pieceGeometry.morphAttributes.position = morphTargetPositions.map((targetPositions) => new BufferAttribute(targetPositions, 3));
  pieceGeometry.morphAttributes.normal = morphTargetPositions.map((targetPositions) => measureSmoothNormals(targetPositions, vertexOrder));
  return pieceGeometry;
}

// The top layer leaves first and the cube falls apart downwards; the shapes are spread so neighbours differ.
function planPieceMotions(): PieceMotion[] {
  const gridOffsets = Array.from({ length: piecesPerEdge }, (_, offsetIndex) => offsetIndex - (piecesPerEdge - 1) / 2);
  const pieceMotions: PieceMotion[] = [];
  for (const offsetX of gridOffsets) {
    for (const offsetY of gridOffsets) {
      for (const offsetZ of gridOffsets) {
        const pieceIndex = pieceMotions.length;
        const homePosition = new Vector3(offsetX, offsetY, offsetZ).multiplyScalar(pieceSpacing);
        const heightShare = (offsetY - gridOffsets[0]!) / (piecesPerEdge - 1);
        pieceMotions.push({
          homePosition,
          scatteredPosition: homePosition.clone().multiplyScalar(scatterSpread).addScaledVector(pickRandomDirection(pieceIndex + 1), scatterJitter),
          spinAxis: pickRandomDirection(pieceIndex + piecesPerEdge ** 3),
          spinAngle: (1 + measurePseudoRandom(pieceIndex + 2)) * Math.PI,
          startDelayShare: (1 - heightShare) * layerDelayShare + measurePseudoRandom(pieceIndex + 3) * randomDelayShare,
          morphTargetIndex: ((pieceIndex + offsetY + 1) % (morphTargetCount + 1)) - 1,
          driftPhase: measurePseudoRandom(pieceIndex + 4) * fullTurn,
        });
      }
    }
  }
  return pieceMotions;
}

// The logo gradient lies still across the slide, from purple at the top left to green at the bottom right: a piece takes the colour of where it flies.
function measureGradientShare(worldPosition: Vector3): number {
  const gradientShare = (worldPosition.x - worldPosition.y * gradientTilt + gradientReach) / (2 * gradientReach);
  return Math.min(1, Math.max(0, gradientShare));
}

// A context the browser refuses leaves the slide white instead of breaking it.
function createCubeStage(paintedCanvas: HTMLCanvasElement): CubeStage | undefined {
  let webglRenderer: WebGLRenderer;
  try {
    webglRenderer = new WebGLRenderer({ canvas: paintedCanvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    return undefined;
  }
  webglRenderer.setClearColor(backgroundColor);
  webglRenderer.outputColorSpace = SRGBColorSpace;
  webglRenderer.toneMapping = NeutralToneMapping;
  webglRenderer.shadowMap.enabled = true;
  webglRenderer.shadowMap.type = VSMShadowMap;

  const cubeScene = new Scene();
  const environmentGenerator = new PMREMGenerator(webglRenderer);
  const roomEnvironment = new RoomEnvironment();
  const environmentTexture = environmentGenerator.fromScene(roomEnvironment, environmentBlur).texture;
  roomEnvironment.dispose();
  environmentGenerator.dispose();
  cubeScene.environment = environmentTexture;

  const keyLight = new DirectionalLight(backgroundColor, keyLightIntensity);
  keyLight.position.copy(keyLightPosition);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  Object.assign(keyLight.shadow.camera, { left: -shadowReach, right: shadowReach, top: shadowReach, bottom: -shadowReach, near: shadowNear, far: shadowFar });
  keyLight.shadow.radius = shadowBlurRadius;
  keyLight.shadow.blurSamples = shadowBlurSamples;
  cubeScene.add(keyLight);

  const floorGeometry = new CircleGeometry(floorRadius, floorSegments);
  const floorMaterial = new ShadowMaterial({ opacity: floorShadowOpacity });
  const shadowFloor = new Mesh(floorGeometry, floorMaterial);
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = floorDepth;
  shadowFloor.receiveShadow = true;
  cubeScene.add(shadowFloor);

  const pieceGeometry = buildMorphingPieceGeometry();
  const pieceMaterial = new MeshPhysicalMaterial({ roughness: pieceRoughness, clearcoat: pieceClearcoat, clearcoatRoughness: pieceClearcoatRoughness });
  const pieceMotions = planPieceMotions();
  const pieceMesh = new InstancedMesh(pieceGeometry, pieceMaterial, pieceMotions.length);
  pieceMesh.castShadow = true;
  pieceMesh.frustumCulled = false;
  const travellingGroup = new Group();
  travellingGroup.add(pieceMesh);
  const pointerTiltGroup = new Group();
  pointerTiltGroup.add(travellingGroup);
  cubeScene.add(pointerTiltGroup);

  const sceneCamera = new PerspectiveCamera(cameraFieldOfView, 1, cameraNear, cameraFar);
  sceneCamera.position.set(0, cameraHeight, cameraDistance);
  sceneCamera.lookAt(0, 0, 0);

  const influenceCarrier = new Mesh(pieceGeometry);
  const morphInfluences = influenceCarrier.morphTargetInfluences!;
  const pieceMatrix = new Matrix4();
  const piecePosition = new Vector3();
  const pieceRotation = new Quaternion();
  const pieceScale = new Vector3();
  const driftOffset = new Vector3();
  const worldPosition = new Vector3();
  const gradientStart = new Color(gradientStartColor);
  const gradientEnd = new Color(gradientEndColor);
  const pieceColor = new Color();
  const verticalAxis = new Vector3(0, 1, 0);
  const pointerRaycaster = new Raycaster();
  const pointerSpring = createSpringState();
  const pointerRest = new Vector3();
  const pieceSprings = pieceMotions.map(createSpringState);
  const repelTarget = new Vector3();
  const closestRayPoint = new Vector3();
  const strikeOrigin = new Vector3();
  const strikePush = new Vector3();
  const cubeCentre = new Vector3();
  const worldToCube = new Quaternion();
  let aimedPointer: Vector2 | undefined;
  let pendingStrike: Vector2 | undefined;
  let spinKickVelocity = 0;
  let spinKickAngle = 0;
  let paintedSizeKey = "";

  return {
    aimPointer(pointerPlace) {
      aimedPointer = pointerPlace?.clone();
    },
    strikeAt(pointerPlace) {
      pendingStrike = pointerPlace.clone();
    },
    paintMoment({ pixelWidth, pixelHeight }, elapsedSeconds, stepSeconds) {
      const sizeKey = `${pixelWidth}x${pixelHeight}`;
      if (paintedSizeKey !== sizeKey) {
        paintedSizeKey = sizeKey;
        webglRenderer.setSize(pixelWidth, pixelHeight, false);
        sceneCamera.aspect = pixelWidth / pixelHeight;
        sceneCamera.setViewOffset(pixelWidth, pixelHeight, -pixelWidth * sceneShiftShare, 0, pixelWidth, pixelHeight);
      }
      const cycleMoment = elapsedSeconds % cycleSeconds;
      pointerRest.set(aimedPointer?.x ?? 0, aimedPointer?.y ?? 0, 0);
      advanceSpring(pointerSpring, pointerRest, pointerSpringStiffness, pointerSpringDamping, stepSeconds);
      const { x: smoothedPointerX, y: smoothedPointerY } = pointerSpring.springPosition;
      sceneCamera.position.set(smoothedPointerX * cameraParallaxWidth, cameraHeight + smoothedPointerY * cameraParallaxHeight, cameraDistance);
      sceneCamera.lookAt(0, 0, 0);
      sceneCamera.updateMatrixWorld();
      pointerTiltGroup.rotation.set(-smoothedPointerY * pointerTiltAngle, smoothedPointerX * pointerTiltAngle, 0);
      spinKickAngle += spinKickVelocity * stepSeconds;
      spinKickVelocity *= Math.exp(-spinFriction * stepSeconds);
      travellingGroup.rotation.set(
        restingTilt + Math.sin(elapsedSeconds * tiltSpeed) * tiltSwing,
        restingYaw + elapsedSeconds * turnSpeed + spinKickAngle,
        Math.sin(elapsedSeconds * rollSpeed) * rollSwing,
      );
      travellingGroup.position.set(
        Math.sin(elapsedSeconds * orbitSpeed) * orbitRadius,
        Math.sin(elapsedSeconds * bobSpeed) * bobAmplitude,
        Math.cos(elapsedSeconds * orbitSpeed) * orbitRadius,
      );
      pointerTiltGroup.updateMatrixWorld();
      travellingGroup.getWorldQuaternion(worldToCube).invert();
      travellingGroup.getWorldPosition(cubeCentre);
      if (pendingStrike !== undefined) {
        pointerRaycaster.setFromCamera(pendingStrike, sceneCamera);
        pointerRaycaster.ray.closestPointToPoint(cubeCentre, strikeOrigin);
        spinKickVelocity += Math.sign(pendingStrike.x - cubeCentre.clone().project(sceneCamera).x) * spinKickSpeed;
      }
      if (aimedPointer !== undefined) pointerRaycaster.setFromCamera(aimedPointer, sceneCamera);
      const aimedRay = aimedPointer === undefined ? undefined : pointerRaycaster.ray;
      pieceMotions.forEach((pieceMotion, pieceIndex) => {
        const { homePosition, scatteredPosition, spinAxis, spinAngle, startDelayShare, morphTargetIndex, driftPhase } = pieceMotion;
        const explodedShare =
          easeInOutCubic(measurePieceShare(cycleMoment, explodeStartSeconds, explodeSeconds, startDelayShare)) -
          easeInOutQuint(measurePieceShare(cycleMoment, reassembleStartSeconds, reassembleSeconds, largestStartDelayShare - startDelayShare));
        const morphedShare =
          easeInOutCubic(measurePieceShare(cycleMoment, morphStartSeconds, morphSeconds, startDelayShare)) -
          easeInOutCubic(measurePieceShare(cycleMoment, morphBackStartSeconds, morphSeconds, startDelayShare));
        const driftAngle = elapsedSeconds * driftSpeed + driftPhase;
        piecePosition
          .copy(scatteredPosition)
          .applyAxisAngle(verticalAxis, swirlAngle * explodedShare)
          .addScaledVector(driftOffset.set(Math.sin(driftAngle), Math.cos(driftAngle * driftSpeedRatioY), Math.sin(driftAngle * driftSpeedRatioZ)), driftAmplitude * explodedShare)
          .lerp(homePosition, 1 - explodedShare);
        worldPosition.copy(piecePosition).applyMatrix4(travellingGroup.matrixWorld);
        repelTarget.set(0, 0, 0);
        if (aimedRay !== undefined) {
          aimedRay.closestPointToPoint(worldPosition, closestRayPoint);
          const rayDistance = worldPosition.distanceTo(closestRayPoint);
          const repelShare = Math.max(0, 1 - rayDistance / repelRadius) ** 2 * explodedShare;
          if (repelShare > 0) repelTarget.subVectors(worldPosition, closestRayPoint).setLength(repelDistance * repelShare).applyQuaternion(worldToCube);
        }
        const pieceSpring = pieceSprings[pieceIndex]!;
        if (pendingStrike !== undefined) {
          strikePush.subVectors(worldPosition, strikeOrigin);
          const strikeFalloff = 1 / (1 + (strikePush.length() / strikeReach) ** 2);
          pieceSpring.springVelocity.addScaledVector(strikePush.normalize().applyQuaternion(worldToCube), strikeImpulse * strikeFalloff);
        }
        advanceSpring(pieceSpring, repelTarget, pieceSpringStiffness, pieceSpringDamping, stepSeconds);
        piecePosition.add(pieceSpring.springPosition);
        pieceRotation.setFromAxisAngle(spinAxis, (spinAngle + cycleMoment * spinSpeed) * explodedShare);
        pieceScale.setScalar(1 + (smallShapeScale - 1) * morphedShare);
        pieceMesh.setMatrixAt(pieceIndex, pieceMatrix.compose(piecePosition, pieceRotation, pieceScale));
        worldPosition.copy(piecePosition).applyMatrix4(travellingGroup.matrixWorld);
        pieceMesh.setColorAt(pieceIndex, pieceColor.lerpColors(gradientStart, gradientEnd, measureGradientShare(worldPosition)));
        morphInfluences.fill(0);
        if (morphTargetIndex !== keepsCubeShape) morphInfluences[morphTargetIndex] = morphedShare;
        pieceMesh.setMorphAt(pieceIndex, influenceCarrier);
      });
      pendingStrike = undefined;
      pieceMesh.instanceMatrix.needsUpdate = true;
      pieceMesh.morphTexture!.needsUpdate = true;
      pieceMesh.instanceColor!.needsUpdate = true;
      webglRenderer.render(cubeScene, sceneCamera);
    },
    releaseStage() {
      pieceMesh.dispose();
      pieceGeometry.dispose();
      pieceMaterial.dispose();
      floorGeometry.dispose();
      floorMaterial.dispose();
      keyLight.dispose();
      environmentTexture.dispose();
      webglRenderer.dispose();
      webglRenderer.forceContextLoss();
    },
  };
}

// On screen the drawing buffer follows the displayed size, but never grows past the slide's own pixels; a still copy takes them all, for print.
function measureCanvasPixels(canvasElement: HTMLElement, followsScreen: boolean): PixelSize {
  const layoutWidth = Math.max(1, canvasElement.offsetWidth);
  const layoutHeight = Math.max(1, canvasElement.offsetHeight);
  const displayScale = canvasElement.getBoundingClientRect().width / layoutWidth;
  const pixelShare = followsScreen ? Math.min(1, displayScale * window.devicePixelRatio) : 1;
  return { pixelWidth: Math.max(1, Math.round(layoutWidth * pixelShare)), pixelHeight: Math.max(1, Math.round(layoutHeight * pixelShare)) };
}

// Thumbnails, printed pages and reduced motion get a JPEG: a canvas prints with a soft mask, and the context is released right after.
export function paintStillPicture(pictureElement: HTMLImageElement) {
  const pixelSize = measureCanvasPixels(pictureElement, false);
  const sizeKey = `${pixelSize.pixelWidth}x${pixelSize.pixelHeight}`;
  if (!stillPictureAddresses.has(sizeKey)) {
    const stillCanvas = document.createElement("canvas");
    const stillStage = createCubeStage(stillCanvas);
    if (stillStage === undefined) return;
    stillStage.paintMoment(pixelSize, stillMomentSeconds, 0);
    stillPictureAddresses.set(sizeKey, stillCanvas.toDataURL(stillPictureFormat, stillPictureQuality));
    stillStage.releaseStage();
  }
  pictureElement.src = stillPictureAddresses.get(sizeKey)!;
}

// Each run of the effect builds a stage on a canvas of its own: a released WebGL context never comes back,
// and React in development runs the effect twice on one element.
// The mouse tilts the cube and pushes flying pieces aside, a click sends a shockwave. On touch a tap still turns the slide,
// so the shockwave waits for a press held longer than a tap; dragging a finger works as the mouse.
export function runLiveCube(stageHost: HTMLElement): () => void {
  const canvasElement = document.createElement("canvas");
  canvasElement.className = "absolute inset-0 size-full";
  stageHost.append(canvasElement);
  const cubeStage = createCubeStage(canvasElement);
  if (cubeStage === undefined) return () => canvasElement.remove();
  const slideElement = canvasElement.closest<HTMLElement>("[data-slide]")!;
  const startTime = performance.now();
  let previousFrameTime = startTime;
  let animationFrameRequest = 0;
  let touchHoldTimer = 0;
  const measurePointerPlace = ({ clientX, clientY }: PointerEvent) => {
    const canvasBox = canvasElement.getBoundingClientRect();
    return new Vector2(((clientX - canvasBox.left) / canvasBox.width) * 2 - 1, 1 - ((clientY - canvasBox.top) / canvasBox.height) * 2);
  };
  const followPointer = (pointerEvent: PointerEvent) => cubeStage.aimPointer(measurePointerPlace(pointerEvent));
  const forgetPointer = (pointerEvent: PointerEvent) => {
    if (pointerEvent.pointerType === "touch" || pointerEvent.relatedTarget === null) cubeStage.aimPointer(undefined);
  };
  const pressSlide = (pointerEvent: PointerEvent) => {
    const pointerPlace = measurePointerPlace(pointerEvent);
    cubeStage.aimPointer(pointerPlace);
    if (pointerEvent.pointerType === "touch") touchHoldTimer = window.setTimeout(() => cubeStage.strikeAt(pointerPlace), touchHoldMilliseconds);
    else if (pointerEvent.button === 0) cubeStage.strikeAt(pointerPlace);
  };
  const releasePress = (pointerEvent: PointerEvent) => {
    window.clearTimeout(touchHoldTimer);
    forgetPointer(pointerEvent);
  };
  const paintNextFrame = () => {
    const frameTime = performance.now();
    const stepSeconds = Math.min(longestStepSeconds, (frameTime - previousFrameTime) / millisecondsPerSecond);
    previousFrameTime = frameTime;
    cubeStage.paintMoment(measureCanvasPixels(canvasElement, true), (frameTime - startTime) / millisecondsPerSecond, stepSeconds);
    animationFrameRequest = requestAnimationFrame(paintNextFrame);
  };
  window.addEventListener("pointermove", followPointer);
  window.addEventListener("pointerout", forgetPointer);
  window.addEventListener("pointerup", releasePress);
  window.addEventListener("pointercancel", releasePress);
  slideElement.addEventListener("pointerdown", pressSlide);
  paintNextFrame();
  return () => {
    cancelAnimationFrame(animationFrameRequest);
    window.clearTimeout(touchHoldTimer);
    window.removeEventListener("pointermove", followPointer);
    window.removeEventListener("pointerout", forgetPointer);
    window.removeEventListener("pointerup", releasePress);
    window.removeEventListener("pointercancel", releasePress);
    slideElement.removeEventListener("pointerdown", pressSlide);
    cubeStage.releaseStage();
    canvasElement.remove();
  };
}
