import {
  EPSILON,
  Fn,
  PI2,
  cos,
  mix,
  mod,
  instancedArray,
  instanceIndex,
  hash,
  float,
  floor,
  vec3,
  vec4,
  smoothstep,
  vec2,
  texture,
  step,
  sin,
  abs,
  If,
  remap,
  max,
  min,
  atomicAdd,
  atomicStore,
  storage,
} from "three/tsl";
import { IndirectStorageBufferAttribute, type Node } from "three/webgpu";
import { assetManager, windManager } from "../../../systems";
import { TSLUtils } from "../../../utils/TSLUtils";
import { gameDeltaTime, gameTime } from "../../../utils/GameTime";
import { config, uniforms } from "./config";

type StochasticKeepArgs = [
  worldPos: Node<"vec3">,
  playerPosition: Node<"vec3">,
  R0: Node<"float">,
  R1: Node<"float">,
  pMin: Node<"float">,
  bladeHeight: Node<"float">,
  clipPosition: Node<"vec4">,
  fY: Node<"float">,
  projectedMin: Node<"float">,
  projectedFull: Node<"float">,
  spacing: Node<"float">,
  previousKeep: Node<"float">,
  hysteresis: Node<"float">,
];

export class GrassCompute {
  readonly indirectDrawAttribute = new IndirectStorageBufferAttribute(
    new Uint32Array([
      config.BLADE_INDEX_COUNT, // index count
      0, // instance count, updated every frame by the atomic counter
      0, // first index
      0, // base vertex
      0, // first instance
    ]),
    1, // each argument is one uint
  );
  private atomicIndirectDrawArguments = storage(
    this.indirectDrawAttribute,
    "uint",
    this.indirectDrawAttribute.count,
  ).toAtomic();
  // instanceCount is the second indirect draw argument
  private atomicCounter = this.atomicIndirectDrawArguments.element(1);
  // x -> offsetX, y -> offsetZ, z -> packed bend, w -> packed scale and visibility
  private bladeState = instancedArray(config.COUNT, "vec4");
  // x -> 0/4 position based noise - 4/16 offsetY - 20/4 baked shadow
  private bladeTerrain = instancedArray(config.COUNT, "float");
  private windState = instancedArray(config.COUNT, "vec2");
  private visibleIndices = instancedArray(config.COUNT, "uint");

  private computeStochasticKeep = Fn<StochasticKeepArgs, Node<"float">>(
    ([
      worldPos,
      playerPosition,
      R0,
      R1,
      pMin,
      bladeHeight,
      clipPosition,
      fY,
      projectedMin,
      projectedFull,
      spacing,
      previousKeep,
      hysteresis,
    ]) => {
      const dx = worldPos.x.sub(playerPosition.x);
      const dz = worldPos.z.sub(playerPosition.z);
      const distSq = dx.mul(dx).add(dz.mul(dz));
      const R0Sq = R0.mul(R0);
      const R1Sq = R1.mul(R1);
      const t = distSq
        .sub(R0Sq)
        .div(max(R1Sq.sub(R0Sq), EPSILON))
        .clamp();
      const pDistance = mix(1, pMin, t);
      const eyeDepthAbs = clipPosition.w.abs().max(EPSILON);
      const projectedBladeHeight = fY.mul(bladeHeight).div(eyeDepthAbs);
      const pScreen = smoothstep(
        projectedMin,
        projectedFull,
        projectedBladeHeight,
      );
      const p = pDistance.mul(pScreen);
      const cell = floor(worldPos.xz.div(spacing));
      const rnd = hash(cell.x.mul(12.9898).add(cell.y.mul(78.233)));
      const enterThreshold = rnd.add(hysteresis).clamp();
      const stayThreshold = rnd.sub(hysteresis).clamp(EPSILON, 1);
      const enterKeep = step(enterThreshold, p);
      const stayKeep = step(stayThreshold, p);
      return mix(enterKeep, stayKeep, previousKeep);
    },
  );

  get bladeStateBuffer() {
    return this.bladeState;
  }

  get bladeTerrainBuffer() {
    return this.bladeTerrain;
  }

  get visibleIndexBuffer() {
    return this.visibleIndices;
  }

  getYOffset = Fn<[value: Node<"float">], Node<"float">>(([data]) => {
    return TSLUtils.unpackUnits(
      data,
      4,
      16,
      0,
      Math.ceil(assetManager.resources.heightmap.userData.max),
    );
  });

  getBend = Fn<[value: Node<"vec4">], Node<"vec2">>(([data]) => {
    const x = TSLUtils.unpackUnits(data.z, 0, 12, -6, 6);
    const z = TSLUtils.unpackUnits(data.z, 12, 12, -6, 6);
    return vec2(x, z);
  });

  getScale = Fn<[value: Node<"vec4">], Node<"float">>(([data]) => {
    return TSLUtils.unpackUnits(data.w, 0, 8, 0, uniforms.uBladeMaxScale);
  });

  private getOriginalScale = Fn<
    [value: Node<"vec4">],
    Node<"float">
  >(([data]) => {
    return TSLUtils.unpackUnits(
      data.w,
      8,
      8,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
  });

  getVisibility = Fn<[value: Node<"vec4">], Node<"float">>(([data]) => {
    return TSLUtils.unpackFlag(data.w, 17);
  });

  getPositionNoise = Fn<[value: Node<"float">], Node<"float">>(([data]) => {
    return TSLUtils.unpackUnit(data, 0, 4);
  });

  getBakedShadowFactor = Fn<[value: Node<"float">], Node<"float">>(([data]) => {
    return TSLUtils.unpackUnit(data, 20, 4);
  });

  private setYOffset = Fn<
    [data: Node<"float">, value: Node<"float">],
    Node<"float">
  >(([data, value]) => {
    return TSLUtils.packUnits(
      data,
      4,
      16,
      value,
      0,
      Math.ceil(assetManager.resources.heightmap.userData.max),
    );
  });

  private setBend = Fn<[data: Node<"vec4">, value: Node<"vec2">], Node<"vec4">>(
    ([data, value]) => {
      data.z = TSLUtils.packUnits(data.z, 0, 12, value.x, -6, 6);
      data.z = TSLUtils.packUnits(data.z, 12, 12, value.y, -6, 6);
      return data;
    },
  );

  private setScale = Fn<
    [data: Node<"vec4">, value: Node<"float">],
    Node<"vec4">
  >(([data, value]) => {
    data.w = TSLUtils.packUnits(
      data.w,
      0,
      8,
      value,
      0,
      uniforms.uBladeMaxScale,
    );
    return data;
  });

  private setOriginalScale = Fn<
    [data: Node<"vec4">, value: Node<"float">],
    Node<"vec4">
  >(([data, value]) => {
    data.w = TSLUtils.packUnits(
      data.w,
      8,
      8,
      value,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
    return data;
  });

  private setVisibility = Fn<
    [data: Node<"vec4">, value: Node<"float">],
    Node<"vec4">
  >(([data, value]) => {
    data.w = TSLUtils.packFlag(data.w, 17, value);
    return data;
  });

  private setPositionNoise = Fn<
    [data: Node<"float">, value: Node<"float">],
    Node<"float">
  >(([data, value]) => {
    return TSLUtils.packUnit(data, 0, 4, value);
  });

  private setBakedShadowFactor = Fn<
    [data: Node<"float">, value: Node<"float">],
    Node<"float">
  >(([data, value]) => {
    return TSLUtils.packUnit(data, 20, 4, value);
  });

  computeInit = Fn(() => {
    const bladeState = this.bladeState.element(instanceIndex);
    const bladeTerrain = this.bladeTerrain.element(instanceIndex);
    const row = floor(float(instanceIndex).div(config.BLADES_PER_SIDE));
    const col = float(instanceIndex).mod(config.BLADES_PER_SIDE);
    const randX = hash(instanceIndex.add(4321));
    const randZ = hash(instanceIndex.add(1234));
    const offsetX = col
      .mul(config.SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randX.mul(config.SPACING * 0.5));
    const offsetZ = row
      .mul(config.SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randZ.mul(config.SPACING * 0.5));
    const _uv = vec3(offsetX, 0, offsetZ)
      .xz.add(config.TILE_HALF_SIZE)
      .div(config.TILE_SIZE)
      .abs()
      .fract();
    const noise = texture(assetManager.resources.noiseAtlas, _uv);
    const wrapNoise = noise.b.sub(0.5);
    const noiseX = wrapNoise.mul(17).fract();
    const noiseZ = wrapNoise.mul(13).fract();
    bladeState.x = offsetX.add(noiseX);
    bladeState.y = offsetZ.add(noiseZ);

    bladeTerrain.assign(this.setPositionNoise(bladeTerrain, noise.g));
    const n = noise.b;
    const shaped = n.mul(n);
    const randomScale = remap(
      shaped,
      0,
      1,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
    bladeState.assign(this.setScale(bladeState, randomScale));
    bladeState.assign(this.setOriginalScale(bladeState, randomScale));
    bladeState.assign(this.setBend(bladeState, vec2(0)));
    this.windState.element(instanceIndex).assign(vec2(0));
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  private computeWind = Fn<
    [
      prevWindXZ: Node<"vec2">,
      worldPos: Node<"vec3">,
      positionNoise: Node<"float">,
      resetWind: Node<"float">,
    ],
    Node<"vec3">
  >(([prevWindXZ, worldPos, positionNoise, resetWind]) => {
    const baseDir = windManager.uDirection;
    const windEvent = windManager.uIntensityDirectional;
    const perp = vec2(baseDir.y.negate(), baseDir.x);

    const scrollDir = perp.mul(0.3717).sub(baseDir);
    const uv = worldPos.xz
      .mul(uniforms.uvWindScale.mul(0.01))
      .add(scrollDir.mul(uniforms.uWindSpeed.mul(gameTime)));
    const noise = texture(assetManager.resources.noiseAtlas, uv);

    const fastGust = sin(noise.g.mul(18.85)).mul(0.5).add(0.5);
    const gustField = mix(noise.r, fastGust, windEvent);
    const gustStart = float(1).sub(uniforms.uWindGustCoverage);
    const gust = smoothstep(gustStart, gustStart.add(0.25), gustField);
    const windFactor = uniforms.uWindStrength
      .mul(mix(uniforms.uWindLull, 1, gust))
      .mul(mix(1, 4, windEvent));

    const veer = noise.g.sub(0.5).mul(2).mul(uniforms.uWindEddyStrength);
    const target = baseDir.add(perp.mul(veer)).mul(windFactor);

    const rate = mix(3.5, 11, positionNoise).mul(mix(0.3, 1, gust));
    const k = min(rate.mul(gameDeltaTime), 1);
    const dampedWind = prevWindXZ.add(target.sub(prevWindXZ).mul(k));
    const newWind = mix(dampedWind, target, resetWind);

    return vec3(newWind, gust);
  });

  private computeBladeDeformation = Fn<
    [
      windXZ: Node<"vec2">,
      gust: Node<"float">,
      worldPos: Node<"vec3">,
      scaleY: Node<"float">,
    ],
    Node<"vec2">
  >(([windXZ, gust, worldPos, scaleY]) => {
    const bladeSeed = hash(instanceIndex);
    const instanceNoise = bladeSeed.mul(0.25).sub(0.125);
    const spriteNoise = bladeSeed.mul(31.7).fract().mul(2).sub(1);
    const scaleWindFactor = mix(
      0.25,
      1,
      smoothstep(uniforms.uBladeMinScale, uniforms.uBladeMaxScale, scaleY),
    );
    const windBend = windXZ.dot(windXZ).mul(3.5).clamp();
    const windNoiseShade = smoothstep(0.2, 1, gust);
    const windNoiseFactor = max(windBend, windNoiseShade.mul(0.45));
    const swayEnvelope = mix(0.75, 1.35, windNoiseFactor);
    const randomPhase = instanceNoise.mul(25.13);
    const heightPhase = swayEnvelope.mul(0.55);
    const swayRate = spriteNoise.remap(-1, 1, 0.7, 1.45);
    const swayA = sin(
      gameTime.mul(swayRate.mul(1.35)).add(randomPhase).add(heightPhase),
    );
    const swayB = sin(
      gameTime
        .mul(swayRate.mul(2.15))
        .add(worldPos.x.mul(0.17))
        .add(worldPos.z.mul(0.11))
        .add(randomPhase.mul(1.7))
        .add(heightPhase.mul(1.6)),
    ).mul(0.45);
    const ambientAngle = bladeSeed.mul(53.3).fract().mul(PI2);
    const ambientOffset = vec2(cos(ambientAngle), sin(ambientAngle)).mul(
      swayA
        .add(swayB)
        .mul(uniforms.uAmbientSwayStrength)
        .mul(swayEnvelope),
    );
    const perpendicularWind = vec2(
      windManager.uDirection.y.negate(),
      windManager.uDirection.x,
    );
    const bendStrength = uniforms.uBaseBending.mul(scaleWindFactor);
    const flutterPhase = bladeSeed
      .mul(97.13)
      .fract()
      .mul(PI2)
      .add(worldPos.x.mul(0.13))
      .add(worldPos.z.mul(0.07));
    const flutter = sin(
      gameTime
        .mul(uniforms.uWindSpeed.mul(1.7))
        .add(flutterPhase.mul(1.3))
        .add(heightPhase.mul(2.2)),
    )
      .mul(0.025)
      .mul(windNoiseFactor)
      .mul(bendStrength);

    return windXZ
      .mul(bendStrength)
      .add(ambientOffset)
      .add(perpendicularWind.mul(flutter));
  });

  computeResetInstanceCount = Fn(() => {
    atomicStore(this.atomicCounter, 0);
  })().compute(1, [1]); // one invocation in a one-thread workgroup

  computeUpdate = Fn(() => {
    const bladeState = this.bladeState.element(instanceIndex);
    const bladeTerrain = this.bladeTerrain.element(instanceIndex);

    const previousOffset = vec2(bladeState.x, bladeState.y);
    const unwrappedOffset = previousOffset.sub(uniforms.uPlayerDeltaXZ);
    const wrappedOffsetX = mod(
      unwrappedOffset.x.add(config.TILE_HALF_SIZE),
      config.TILE_SIZE,
    ).sub(config.TILE_HALF_SIZE);
    const wrappedOffsetZ = mod(
      unwrappedOffset.y.add(config.TILE_HALF_SIZE),
      config.TILE_SIZE,
    ).sub(config.TILE_HALF_SIZE);
    const wrappedOffset = vec3(wrappedOffsetX, 0, wrappedOffsetZ);

    const wrapDelta = wrappedOffset.xz.sub(unwrappedOffset);
    const isWrapped = step(
      config.TILE_HALF_SIZE,
      max(abs(wrapDelta.x), abs(wrapDelta.y)),
    );

    bladeState.x = wrappedOffset.x;
    bladeState.y = wrappedOffset.z;

    const worldPos = wrappedOffset.add(uniforms.uPlayerPosition);
    const wasVisible = this.getVisibility(bladeState);
    const currentScale = this.getScale(bladeState);
    const originalScale = this.getOriginalScale(bladeState);
    const previousKeep = wasVisible.mul(float(1).sub(isWrapped));
    const clipPosition = uniforms.uCameraMatrix.mul(vec4(worldPos, 1));

    const passesStochasticThinning = this.computeStochasticKeep(
      worldPos,
      uniforms.uPlayerPosition,
      uniforms.uR0,
      uniforms.uR1,
      uniforms.uPMin,
      currentScale.mul(config.BLADE_HEIGHT),
      clipPosition,
      uniforms.uFy,
      uniforms.uProjectedMin,
      uniforms.uProjectedFull,
      config.SPACING,
      previousKeep,
      uniforms.uStochasticHysteresis,
    );

    const isInFrustum = TSLUtils.computeFrustumVisibility(
      clipPosition,
      uniforms.uFx,
      uniforms.uFy,
      config.BLADE_BOUNDING_SPHERE_RADIUS,
      uniforms.uCullPadNDCX,
      uniforms.uCullPadNDCYNear,
      uniforms.uCullPadNDCYFar,
    );
    const isPotentiallyVisible = isInFrustum.mul(passesStochasticThinning);
    bladeState.assign(this.setVisibility(bladeState, isPotentiallyVisible));
    bladeTerrain.assign(this.setBakedShadowFactor(bladeTerrain, 1));

    If(isPotentiallyVisible, () => {
      const terrainMaps = texture(
        assetManager.resources.terrainMaps,
        TSLUtils.computeMapUvByPosition(worldPos.xz),
      );

      const grassScale = terrainMaps.g
        .sub(0.25)
        .div(1 - 0.25)
        .clamp();
      const baseScale = originalScale.mul(grassScale);
      const isVisible = step(config.MIN_VISIBLE_SCALE, baseScale);
      bladeState.assign(this.setVisibility(bladeState, isVisible));
      const recoveredScale = mix(
        currentScale,
        baseScale,
        uniforms.uTrailGrowthRate,
      );
      const didAppear = isVisible.mul(float(1).sub(wasVisible));
      const shouldReset = max(isWrapped, didAppear);
      const scaleBeforeTrail = mix(recoveredScale, baseScale, shouldReset);

      If(isVisible, () => {
        const mapUv = TSLUtils.computeMapUvByPosition(worldPos.xz);
        const heightUv = vec2(mapUv.x, float(1).sub(mapUv.y));
        const yOffset = texture(assetManager.resources.heightmap, heightUv).r;
        bladeTerrain.assign(this.setYOffset(bladeTerrain, yOffset));

        const diff = worldPos.xz.sub(uniforms.uPlayerPosition.xz);
        const distSq = diff.dot(diff);

        const isPlayerGrounded = step(
          0.1,
          float(1).sub(uniforms.uPlayerPosition.y.sub(yOffset)),
        );

        const contact = float(1)
          .sub(
            smoothstep(
              uniforms.uTrailRadiusSquared.mul(0.35),
              uniforms.uTrailRadiusSquared,
              distSq,
            ),
          )
          .mul(isPlayerGrounded);

        const crushedScale = min(baseScale, uniforms.uTrailMinScale);
        const nextScale = mix(
          scaleBeforeTrail,
          crushedScale,
          uniforms.uKDown.mul(contact),
        );
        bladeState.assign(this.setScale(bladeState, nextScale));

        const positionNoise = this.getPositionNoise(bladeTerrain);
        const windState = this.windState.element(instanceIndex);
        const newWind = this.computeWind(
          windState,
          worldPos,
          positionNoise,
          shouldReset,
        );
        const windXZ = newWind.xy.clamp(-2, 2);
        windState.assign(windXZ);
        bladeState.assign(
          this.setBend(
            bladeState,
            this.computeBladeDeformation(
              windXZ,
              newWind.z,
              worldPos,
              baseScale,
            ),
          ),
        );
        bladeTerrain.assign(
          this.setBakedShadowFactor(bladeTerrain, terrainMaps.r),
        );

        const drawIndex = atomicAdd(this.atomicCounter, 1);
        this.visibleIndices.element(drawIndex).assign(instanceIndex);
      });
    });
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);
}
