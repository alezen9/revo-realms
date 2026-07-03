import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  StaticDrawUsage,
  Uint16BufferAttribute,
  Vector3,
} from "three";
import {
  abs,
  cos,
  float,
  Fn,
  hash,
  instancedArray,
  instanceIndex,
  max,
  mix,
  normalize,
  PI,
  PI2,
  sin,
  smoothstep,
  step,
  texture,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  type ComputeNode,
  InstancedMesh,
  MeshBasicNodeMaterial,
} from "three/webgpu";
import {
  assetManager,
  rendererManager,
  sceneManager,
  windManager,
} from "../../systems";
import { VegetationSsboUtils } from "../Vegetation/ssboUtils";
import type { WindAmbianceUniforms } from "./WindAmbiance";

const getConfig = () => {
  const LINE_COUNT = 24;
  const LINE_SEGMENTS = 36;
  const FIELD_SIZE = 170;

  return {
    LINE_COUNT,
    LINE_SEGMENTS,
    FIELD_SIZE,
    FIELD_HALF_SIZE: FIELD_SIZE / 2,
    EDGE_FADE_SIZE: 24,
    LINE_LIFETIME: 4.8,
    LINE_SPEED: 18,
    RESPAWN_DELAY: 2.2,
    WORKGROUP_SIZE: 64,
  };
};

const config = getConfig();

class WindLineGeometry extends BufferGeometry {
  constructor() {
    super();

    const rowCount = config.LINE_SEGMENTS + 1;
    const vertexCount = rowCount * 2;
    const indexCount = config.LINE_SEGMENTS * 6;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = new Uint16Array(indexCount);

    let indexCursor = 0;
    for (let row = 0; row < rowCount; row++) {
      const progress = row / config.LINE_SEGMENTS;
      const leftIndex = row * 2;
      const rightIndex = leftIndex + 1;

      positions[leftIndex * 3 + 0] = -0.5;
      positions[leftIndex * 3 + 2] = progress;
      positions[rightIndex * 3 + 0] = 0.5;
      positions[rightIndex * 3 + 2] = progress;

      uvs[leftIndex * 2 + 0] = 0;
      uvs[leftIndex * 2 + 1] = progress;
      uvs[rightIndex * 2 + 0] = 1;
      uvs[rightIndex * 2 + 1] = progress;

      if (row === 0) continue;

      const previousLeftIndex = (row - 1) * 2;
      const previousRightIndex = previousLeftIndex + 1;
      indices[indexCursor++] = previousLeftIndex;
      indices[indexCursor++] = previousRightIndex;
      indices[indexCursor++] = rightIndex;
      indices[indexCursor++] = previousLeftIndex;
      indices[indexCursor++] = rightIndex;
      indices[indexCursor++] = leftIndex;
    }

    const positionAttribute = new BufferAttribute(positions, 3);
    positionAttribute.setUsage(StaticDrawUsage);
    this.setAttribute("position", positionAttribute);

    const uvAttribute = new BufferAttribute(uvs, 2);
    uvAttribute.setUsage(StaticDrawUsage);
    this.setAttribute("uv", uvAttribute);
    this.setIndex(new Uint16BufferAttribute(indices, 1));
  }
}

export default class WindAmbianceLines {
  private buffer = instancedArray(config.LINE_COUNT, "vec4");
  private mesh: InstancedMesh;
  private uniforms: WindAmbianceUniforms;
  private computeInit: ComputeNode;
  private computeUpdate: ComputeNode;

  constructor(uniforms: WindAmbianceUniforms) {
    this.uniforms = uniforms;
    this.computeInit = this.createComputeInit();
    this.computeUpdate = this.createComputeUpdate();
    this.mesh = new InstancedMesh(
      new WindLineGeometry(),
      new WindLineMaterial(this, this.uniforms),
      config.LINE_COUNT,
    );
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    sceneManager.scene.add(this.mesh);

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
  }

  get computeBuffer() {
    return this.buffer;
  }

  syncPlayerPosition(playerPosition: Vector3) {
    this.mesh.position.copy(playerPosition);
  }

  setVisible(isVisible: boolean) {
    this.mesh.visible = isVisible;
  }

  async preparePrewarmAsync() {
    this.mesh.visible = true;
    await this.update();
  }

  restorePrewarm() {
    this.mesh.visible = false;
  }

  update() {
    return rendererManager.renderer.computeAsync(this.computeUpdate);
  }

  private createComputeInit() {
    return Fn(() => {
      const data = this.buffer.element(instanceIndex);
      const lineIndex = float(instanceIndex);
      const windDirection = windManager.uDirection;
      const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
      const forwardOffset = lineIndex
        .add(hash(lineIndex.add(51.53)))
        .div(config.LINE_COUNT)
        .mul(config.FIELD_SIZE)
        .sub(config.FIELD_HALF_SIZE);
      const sideOffset = hash(lineIndex.add(71.71))
        .sub(0.5)
        .mul(config.FIELD_SIZE * 0.96);
      const localXZ = windDirection
        .mul(forwardOffset)
        .add(sideDirection.mul(sideOffset));
      const worldPos = vec3(localXZ.x, 0, localXZ.y).add(
        this.uniforms.uPlayerPosition,
      );
      const yOffset = VegetationSsboUtils.computeYOffset(worldPos);
      const grassScale = VegetationSsboUtils.computeGrassScale(worldPos);
      const height = mix(
        1.15,
        this.uniforms.uHeight,
        hash(lineIndex.add(37.37)),
      );
      const age = hash(lineIndex.add(17.37))
        .mul(config.LINE_LIFETIME + config.RESPAWN_DELAY)
        .sub(config.RESPAWN_DELAY);

      data.assign(
        vec4(
          localXZ.x,
          yOffset.add(height).mul(step(0.05, grassScale)),
          localXZ.y,
          age,
        ),
      );
    })().compute(config.LINE_COUNT, [config.WORKGROUP_SIZE]);
  }

  private createComputeUpdate() {
    return Fn(() => {
      const data = this.buffer.element(instanceIndex);
      const lineIndex = float(instanceIndex);
      const windDirection = windManager.uDirection;
      const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
      const wrappedPosition = VegetationSsboUtils.wrapPosition(
        vec2(data.x, data.z),
        this.uniforms.uPlayerDeltaXZ,
        config.FIELD_SIZE,
      );
      const age = data.w.add(this.uniforms.uDelta.mul(this.uniforms.uSpeed));
      const lineSeed = hash(lineIndex.add(this.uniforms.uEventSeed.mul(83.17)));
      const speedVariation = mix(0.58, 1.35, hash(lineSeed.add(9.41)));
      const phase = age.mul(mix(0.75, 1.5, hash(lineSeed.add(21.5))));
      const sideDrift = sin(phase.add(lineSeed.mul(PI2)))
        .mul(0.42)
        .mul(this.uniforms.uDelta);
      const nextXZ = wrappedPosition.xz
        .add(
          windDirection
            .mul(config.LINE_SPEED)
            .mul(this.uniforms.uSpeed)
            .mul(speedVariation)
            .mul(this.uniforms.uDelta),
        )
        .add(sideDirection.mul(sideDrift));
      const forwardDistance = nextXZ.dot(windDirection);
      const sideDistance = nextXZ.dot(sideDirection);
      const outsideForward = step(config.FIELD_HALF_SIZE, abs(forwardDistance));
      const outsideSide = step(config.FIELD_HALF_SIZE, abs(sideDistance));
      const expired = step(config.LINE_LIFETIME, age);
      const shouldRespawn = max(
        max(max(expired, outsideForward), outsideSide),
        this.uniforms.uResetAll,
      );
      const spawnForward = mix(
        config.FIELD_HALF_SIZE * -0.92,
        config.FIELD_HALF_SIZE * 0.12,
        hash(lineSeed.add(3.13)),
      );
      const resetForward = hash(lineIndex.add(51.53))
        .mul(config.FIELD_SIZE)
        .sub(config.FIELD_HALF_SIZE);
      const finalSpawnForward = mix(
        spawnForward,
        resetForward,
        this.uniforms.uResetAll,
      );
      const spawnSide = hash(lineSeed.add(9.71))
        .sub(0.5)
        .mul(config.FIELD_SIZE * 0.96);
      const resetSide = hash(lineIndex.add(71.71))
        .sub(0.5)
        .mul(config.FIELD_SIZE * 0.96);
      const finalSpawnSide = mix(spawnSide, resetSide, this.uniforms.uResetAll);
      const spawnXZ = windDirection
        .mul(finalSpawnForward)
        .add(sideDirection.mul(finalSpawnSide));
      const finalXZ = mix(nextXZ, spawnXZ, shouldRespawn);
      const worldPos = vec3(finalXZ.x, 0, finalXZ.y).add(
        this.uniforms.uPlayerPosition,
      );
      const yOffset = VegetationSsboUtils.computeYOffset(worldPos);
      const grassScale = VegetationSsboUtils.computeGrassScale(worldPos);
      const height = mix(1.1, this.uniforms.uHeight, hash(lineSeed.add(19.37)));
      const initialAge = hash(lineIndex.add(23.57))
        .mul(config.LINE_LIFETIME + config.RESPAWN_DELAY)
        .sub(config.RESPAWN_DELAY);
      const respawnDelay = hash(lineSeed.add(31.91))
        .mul(config.RESPAWN_DELAY)
        .negate();
      const resetAge = mix(respawnDelay, initialAge, this.uniforms.uResetAll);

      data.x = finalXZ.x;
      data.y = yOffset.add(height).mul(step(0.05, grassScale));
      data.z = finalXZ.y;
      data.w = mix(age, resetAge, shouldRespawn);
    })().compute(config.LINE_COUNT, [config.WORKGROUP_SIZE]);
  }
}

class WindLineMaterial extends MeshBasicNodeMaterial {
  constructor(lines: WindAmbianceLines, uniforms: WindAmbianceUniforms) {
    super();

    this.precision = "lowp";
    this.transparent = true;
    this.depthWrite = false;
    this.forceSinglePass = true;
    this.side = DoubleSide;

    const data = lines.computeBuffer.element(instanceIndex);
    const lineIndex = float(instanceIndex);
    const lineAge = data.w;
    const lineSeed = hash(lineIndex.add(uniforms.uEventSeed.mul(97.13)));
    const windDirection = windManager.uDirection;
    const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
    const windForward = vec3(windDirection.x, 0, windDirection.y);
    const windSide = vec3(sideDirection.x, 0, sideDirection.y);
    const curveProgress = uv().y;
    const edgeDistance = abs(uv().x.mul(2).sub(1));
    const sideSign = uv().x.mul(2).sub(1);
    const isAlive = step(0, lineAge);
    const lifeProgress = lineAge.div(config.LINE_LIFETIME).clamp();
    const lifeFade = smoothstep(0, 0.12, lifeProgress).mul(
      float(1).sub(smoothstep(0.82, 1, lifeProgress)),
    );
    const relativeXZ = data.xz;
    const fieldDistance = max(
      abs(relativeXZ.dot(windDirection)),
      abs(relativeXZ.dot(sideDirection)),
    );
    const fieldFade = float(1).sub(
      smoothstep(
        config.FIELD_HALF_SIZE - config.EDGE_FADE_SIZE,
        config.FIELD_HALF_SIZE,
        fieldDistance,
      ),
    );
    const lengthVariation = mix(0.68, 1.38, hash(lineIndex.add(13.73)));
    const widthVariation = mix(0.72, 1.2, hash(lineIndex.add(31.19)));
    const lineLength = mix(34, 72, lengthVariation).mul(
      mix(0.9, 1.14, windManager.uIntensity),
    );
    const headProgress = smoothstep(0, 0.36, lifeProgress).mul(1.18);
    const tailProgress = smoothstep(0.48, 1, lifeProgress).mul(1.18).sub(0.18);
    const headMask = float(1).sub(
      smoothstep(headProgress, headProgress.add(0.08), curveProgress),
    );
    const tailMask = smoothstep(
      tailProgress,
      tailProgress.add(0.08),
      curveProgress,
    );
    const revealMask = headMask.mul(tailMask);
    const tipProfile = sin(curveProgress.mul(PI)).clamp();
    const bodyProfile = smoothstep(0.08, 0.38, curveProgress).mul(
      float(1).sub(smoothstep(0.62, 0.96, curveProgress)),
    );
    const widthProfile = tipProfile
      .mul(mix(0.025, 0.42, bodyProfile))
      .mul(revealMask);
    const lineVisibility = isAlive
      .mul(lifeFade)
      .mul(fieldFade)
      .mul(uniforms.uEffectFade);
    const agePhase = lifeProgress.mul(PI2).add(lineSeed.mul(PI2));
    const snakeA = sin(curveProgress.mul(PI).mul(1.4).add(agePhase));
    const snakeB = sin(
      curveProgress.mul(PI2).mul(1.15).add(lineSeed.mul(11.7)),
    );
    const sideOffset = snakeA
      .mul(lineLength.mul(0.035))
      .add(snakeB.mul(lineLength.mul(0.018)));
    const heightOffset = sin(curveProgress.mul(PI2).add(agePhase.mul(0.8)))
      .mul(uniforms.uHeight)
      .mul(0.16);
    const centerOffset = windForward
      .mul(curveProgress.sub(0.48).mul(lineLength))
      .add(windSide.mul(sideOffset))
      .add(vec3(0, heightOffset, 0));
    const widthTwist = sin(
      curveProgress.mul(PI2).mul(1.7).add(lineSeed.mul(PI2)),
    ).mul(0.18);
    const widthAxis = normalize(
      windSide.mul(cos(widthTwist)).add(vec3(0, sin(widthTwist), 0)),
    );
    const lineWidth = widthProfile
      .mul(widthVariation)
      .mul(lineLength)
      .mul(0.013)
      .mul(lineVisibility);

    this.positionNode = data.xyz
      .add(centerOffset)
      .add(widthAxis.mul(sideSign).mul(lineWidth));

    const edgeFade = float(1).sub(smoothstep(0.08, 0.92, edgeDistance));
    const brushNoiseUv = vec2(
      curveProgress.mul(0.33).add(lineSeed),
      edgeDistance.add(lifeProgress.mul(0.17)).add(lineSeed.mul(1.9)),
    );
    const brushNoise = texture(
      assetManager.resources.noiseAtlas,
      brushNoiseUv,
    ).r;
    const brushBreakup = smoothstep(0.08, 0.68, brushNoise);
    this.colorNode = uniforms.uColor;
    this.opacityNode = float(0.075)
      .mul(lineVisibility)
      .mul(revealMask)
      .mul(edgeFade)
      .mul(brushBreakup);
  }
}
