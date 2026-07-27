import {
  EPSILON,
  Fn,
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
  PI2,
  remap,
  fract,
  max,
  min,
  atomicAdd,
  atomicStore,
  storage,
} from "three/tsl";
import { IndirectStorageBufferAttribute, type Node } from "three/webgpu";
import { assetManager, windManager } from "../../../systems";
import { TSLUtils } from "../../../utils/TSLUtils";
import { gameTime } from "../../../utils/GameTime";
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

export class GrassSsbo {
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
  // x -> offsetX (0 unused)
  // y -> offsetZ (0 unused)
  // z -> 0/12 windX - 12/12 windZ (0 unused)
  // w -> 0/8 current scale - 8/8 original scale - 16/1 unused - 17/1 visibility - 18/6 wind noise factor (1 unused)
  private buffer1 = instancedArray(config.COUNT, "vec4");
  // x -> 0/4 position based noise - 4/16 offsetY - 20/4 baked shadow
  private buffer2 = instancedArray(config.COUNT, "float");
  private visibleBladeIndices = instancedArray(config.COUNT, "uint");

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
      const enterKeep = step(rnd.add(hysteresis), p);
      const stayKeep = step(rnd.sub(hysteresis), p);
      return mix(enterKeep, stayKeep, previousKeep);
    },
  );

  get computeBuffer1() {
    return this.buffer1;
  }

  get computeBuffer2() {
    return this.buffer2;
  }

  get visibleIndexBuffer() {
    return this.visibleBladeIndices;
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

  getWind = Fn<[value: Node<"vec4">], Node<"vec2">>(([data]) => {
    const x = TSLUtils.unpackUnits(data.z, 0, 12, -2, 2);
    const z = TSLUtils.unpackUnits(data.z, 12, 12, -2, 2);
    return vec2(x, z);
  });

  getScale = Fn<[value: Node<"vec4">], Node<"float">>(([data]) => {
    return TSLUtils.unpackUnits(data.w, 0, 8, 0, uniforms.uBladeMaxScale);
  });

  getOriginalScale = Fn<[value: Node<"vec4">], Node<"float">>(([data]) => {
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

  getWindNoise = Fn<[value: Node<"vec4">], Node<"float">>(([data]) => {
    return TSLUtils.unpackUnit(data.w, 18, 6);
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

  private setWind = Fn<[data: Node<"vec4">, value: Node<"vec2">], Node<"vec4">>(
    ([data, value]) => {
      data.z = TSLUtils.packUnits(data.z, 0, 12, value.x, -2, 2);
      data.z = TSLUtils.packUnits(data.z, 12, 12, value.y, -2, 2);
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

  private setWindNoise = Fn<
    [data: Node<"vec4">, value: Node<"float">],
    Node<"vec4">
  >(([data, value]) => {
    data.w = TSLUtils.packUnit(data.w, 18, 6, value);
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
    const data1 = this.buffer1.element(instanceIndex);
    const data2 = this.buffer2.element(instanceIndex);
    // Position XZ
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
    data1.x = offsetX.add(noiseX);
    data1.y = offsetZ.add(noiseZ);

    data2.assign(this.setPositionNoise(data2, noise.g));
    // Scale
    const n = noise.b;
    const shaped = n.mul(n);
    const randomScale = remap(
      shaped,
      0,
      1,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
    data1.assign(this.setScale(data1, randomScale));
    data1.assign(this.setOriginalScale(data1, randomScale));
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
    const bendDir = windManager.uDirection;
    const scrollDir = bendDir.negate();

    const speed = uniforms.uWindSpeed.mul(
      positionNoise.remap(0, 1, 0.95, 2.05),
    );

    const uvBase = worldPos.xz.mul(0.01).mul(uniforms.uvWindScale);
    const scroll = scrollDir.mul(speed).mul(gameTime);

    const uvA = uvBase.add(scroll);
    const noise = texture(assetManager.resources.noiseAtlas, uvA);

    const gustJitter = fract(sin(positionNoise.mul(12.9898)).mul(78.233))
      .mul(2)
      .sub(1);
    const gustTime = sin(gameTime.mul(0.35).add(positionNoise.mul(PI2)))
      .mul(0.5)
      .add(0.5);
    const windEvent = windManager.uIntensityDirectional;
    const windTravel = worldPos.x.mul(bendDir.x).add(worldPos.z.mul(bendDir.y));
    const travelWave = sin(
      windTravel
        .mul(0.18)
        .sub(gameTime.mul(speed).mul(2.2))
        .add(positionNoise.mul(PI2)),
    )
      .mul(0.5)
      .add(0.5);
    const rawBurst = noise.r
      .mul(0.6)
      .add(noise.g.mul(0.25))
      .add(travelWave.mul(0.25))
      .add(gustTime.mul(0.1))
      .add(gustJitter.mul(0.06))
      .clamp();
    const ambientBurst = smoothstep(0.2, 0.72, rawBurst);
    const directionalBurst = smoothstep(0.56, 0.95, rawBurst);
    const ambientFactor = uniforms.uWindStrength.mul(
      mix(0.35, 1.0, ambientBurst),
    );
    const directionalFactor = directionalBurst.mul(windEvent).mul(1.25);
    const windFactor = ambientFactor.add(directionalFactor);
    const gust01 = mix(ambientBurst, directionalBurst, windEvent);

    const perp = vec2(bendDir.y.negate(), bendDir.x);
    const turbulence = perp.mul(gustJitter.mul(0.12).mul(windFactor));
    const target = bendDir.mul(windFactor).add(turbulence);
    const dampingNoise = abs(
      noise.b.mul(2).sub(1).add(gustJitter.mul(0.25)),
    ).clamp();
    const k = mix(0.045, 0.24, dampingNoise).add(windEvent.mul(0.035));
    const dampedWind = prevWindXZ.add(target.sub(prevWindXZ).mul(k));
    const newWind = mix(dampedWind, target, resetWind);

    return vec3(newWind, gust01);
  });

  computeResetInstanceCount = Fn(() => {
    atomicStore(this.atomicCounter, 0);
  })().compute(1, [1]); // one invocation in a one-thread workgroup

  computeUpdate = Fn(() => {
    const data1 = this.buffer1.element(instanceIndex);
    const data2 = this.buffer2.element(instanceIndex);

    // Position
    const previousOffset = vec2(data1.x, data1.y);
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

    data1.x = wrappedOffset.x;
    data1.y = wrappedOffset.z;

    const worldPos = wrappedOffset.add(uniforms.uPlayerPosition);
    const wasVisible = this.getVisibility(data1);
    const currentScale = this.getScale(data1);
    const originalScale = this.getOriginalScale(data1);
    const previousKeep = wasVisible.mul(float(1).sub(isWrapped));
    const clipPosition = uniforms.uCameraMatrix.mul(vec4(worldPos, 1));

    // Visibility
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
    data1.assign(this.setVisibility(data1, isPotentiallyVisible));
    data2.assign(this.setBakedShadowFactor(data2, 1));

    // avoid sampling the grass map for blades already rejected above
    If(isPotentiallyVisible, () => {
      const terrainMaps = texture(
        assetManager.resources.terrainMaps,
        TSLUtils.computeMapUvByPosition(worldPos.xz),
      );

      // Scale
      const grassScale = terrainMaps.g.sub(0.25).div(0.75).clamp();
      const baseScale = originalScale.mul(grassScale);
      const isVisible = step(config.MIN_VISIBLE_SCALE, baseScale);
      data1.assign(this.setVisibility(data1, isVisible));
      const recoveredScale = mix(
        currentScale,
        baseScale,
        uniforms.uTrailGrowthRate,
      );
      const didAppear = isVisible.mul(float(1).sub(wasVisible));
      const shouldReset = max(isWrapped, didAppear);
      const scaleBeforeTrail = mix(recoveredScale, baseScale, shouldReset);

      If(isVisible, () => {
        // Y offset
        const mapUv = TSLUtils.computeMapUvByPosition(worldPos.xz);
        const heightUv = vec2(mapUv.x, float(1).sub(mapUv.y));
        const yOffset = texture(assetManager.resources.heightmap, heightUv).r;
        data2.assign(this.setYOffset(data2, yOffset));

        // Compute distance to player
        const diff = worldPos.xz.sub(uniforms.uPlayerPosition.xz);
        const distSq = diff.dot(diff);

        // Check if the player is on the ground
        const isPlayerGrounded = step(
          0.1,
          float(1).sub(uniforms.uPlayerPosition.y.sub(yOffset)),
        );

        const inner = uniforms.uTrailRadiusSquared.mul(0.35);
        const outer = uniforms.uTrailRadiusSquared;
        const contact = float(1.0)
          .sub(smoothstep(inner, outer, distSq))
          .mul(isPlayerGrounded);

        // Trail
        const crushedScale = min(baseScale, uniforms.uTrailMinScale);
        const nextScale = mix(
          scaleBeforeTrail,
          crushedScale,
          uniforms.uKDown.mul(contact),
        );
        data1.assign(this.setScale(data1, nextScale));

        // Wind
        const positionNoise = this.getPositionNoise(data2);
        const previousWind = this.getWind(data1);
        const newWind = this.computeWind(
          previousWind,
          worldPos,
          positionNoise,
          shouldReset,
        );
        data1.assign(this.setWind(data1, newWind.xy)); // Wind displacement
        const windBend = newWind.xy.dot(newWind.xy).mul(3.5).clamp();
        const windNoiseShade = smoothstep(0.2, 1.0, newWind.z);
        const windShadeMask = max(windBend, windNoiseShade.mul(0.45));
        data1.assign(this.setWindNoise(data1, windShadeMask)); // Wind visual factor

        // Baked shadow
        data2.assign(this.setBakedShadowFactor(data2, terrainMaps.r));

        const drawIndex = atomicAdd(this.atomicCounter, 1);
        this.visibleBladeIndices.element(drawIndex).assign(instanceIndex);
      });
    });
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);
}
