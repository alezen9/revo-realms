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
  uint,
} from "three/tsl";
import { IndirectStorageBufferAttribute, type Node } from "three/webgpu";
import { assetManager, sceneManager, windManager } from "../../../systems";
import { TSLUtils } from "../../../utils/TSLUtils";
import { gameDeltaTime, gameTime } from "../../../utils/GameTime";
import { config, uniforms } from "./config";
import {
  getOriginalScale,
  getPositionNoise,
  getScale,
  getTerrainCacheValidity,
  getVisibility,
  getYOffset,
  setBakedShadowFactor,
  setBend,
  setOriginalScale,
  setPositionNoise,
  setScale,
  setTerrainCacheValidity,
  setVisibility,
  setYOffset,
} from "./GrassBladeData";

type StochasticKeepArgs = [
  worldPos: Node<"vec3">,
  distanceSquared: Node<"float">,
  bladeHeight: Node<"float">,
  previousKeep: Node<"float">,
];

// Draw arguments for every LOD live back to back in one buffer, so the compute
// pass binds a single storage buffer instead of one per LOD. firstInstance points
// each draw at its own region of the visible index list, which is how the material
// resolves its LOD without being told: instance_index starts at firstInstance.
const createIndirectDrawArguments = () => {
  const { LOD_DRAW_PROFILES, LOD_COUNT, INDIRECT_ARGS_STRIDE, COUNT } = config;
  const drawArguments = new Uint32Array(LOD_COUNT * INDIRECT_ARGS_STRIDE);

  for (let lod = 0; lod < LOD_COUNT; lod++) {
    const argsBase = lod * INDIRECT_ARGS_STRIDE;
    const argCountIdx = argsBase + config.INDEX_COUNT_INDEX;
    drawArguments[argCountIdx] = LOD_DRAW_PROFILES[lod].indexCount;
    const argFirstInstanceIdx = argsBase + config.FIRST_INSTANCE_INDEX;
    drawArguments[argFirstInstanceIdx] = lod * COUNT;
  }

  return drawArguments;
};

export class GrassCompute {
  readonly indirectDrawAttribute = new IndirectStorageBufferAttribute(
    createIndirectDrawArguments(),
    1, // each argument is one uint
  );
  private atomicIndirectDrawArguments = storage(
    this.indirectDrawAttribute,
    "uint",
    this.indirectDrawAttribute.count,
  ).toAtomic();
  // x -> offsetX, y -> offsetZ, z -> packed bend
  // w -> 0/8 scale - 8/8 original scale - 16 terrain cache valid - 17 visibility
  private bladeState = instancedArray(config.COUNT, "vec4");
  // x -> 0/4 position based noise - 4/16 offsetY - 20/4 baked shadow
  private bladeTerrain = instancedArray(config.COUNT, "float");
  private cachedGrassScale = instancedArray(config.COUNT, "float");
  private windState = instancedArray(config.COUNT, "vec2");
  // one draw list per LOD, packed as regions of a single buffer; a blade appends
  // to exactly one region, so no region can exceed COUNT
  private visibleIndices = instancedArray(
    config.COUNT * config.LOD_COUNT,
    "uint",
  );

  constructor() {
    this.indirectDrawAttribute.name = "grass.indirectDrawArguments";
    this.bladeState.value.name = "grass.bladeState";
    this.bladeTerrain.value.name = "grass.bladeTerrain";
    this.cachedGrassScale.value.name = "grass.cachedGrassScale";
    this.windState.value.name = "grass.windState";
    this.visibleIndices.value.name = "grass.visibleIndices";
  }

  get bladeStateBuffer() {
    return this.bladeState;
  }

  get bladeTerrainBuffer() {
    return this.bladeTerrain;
  }

  get visibleIndexBuffer() {
    return this.visibleIndices;
  }

  configureSingleDraw(indexCount: number) {
    uniforms.uLodEnabled.value = 0;
    this.indirectDrawAttribute.array[config.INDEX_COUNT_INDEX] = indexCount;
  }

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
    const noiseUv = vec3(offsetX, 0, offsetZ)
      .xz.add(config.TILE_HALF_SIZE)
      .div(config.TILE_SIZE)
      .abs()
      .fract();
    const noise = texture(assetManager.resources.noiseAtlas, noiseUv);
    const wrapNoise = noise.b.sub(0.5);
    const noiseX = wrapNoise.mul(17).fract();
    const noiseZ = wrapNoise.mul(13).fract();
    bladeState.x = offsetX.add(noiseX);
    bladeState.y = offsetZ.add(noiseZ);

    bladeTerrain.assign(setPositionNoise(bladeTerrain, noise.g));
    const scaleNoise = noise.b;
    const shapedScaleNoise = scaleNoise.mul(scaleNoise);
    const randomScale = remap(
      shapedScaleNoise,
      0,
      1,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
    bladeState.assign(setScale(bladeState, randomScale));
    bladeState.assign(setOriginalScale(bladeState, randomScale));
    bladeState.assign(setVisibility(bladeState, 0));
    bladeState.assign(setTerrainCacheValidity(bladeState, 0));
    bladeState.assign(setBend(bladeState, vec2(0)));
    this.cachedGrassScale.element(instanceIndex).assign(0);
    this.windState.element(instanceIndex).assign(vec2(0));
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  computeUpdate = Fn(() => {
    const bladeState = this.bladeState.element(instanceIndex);
    const bladeTerrain = this.bladeTerrain.element(instanceIndex);
    const cachedGrassScale = this.cachedGrassScale.element(instanceIndex);

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
    const wasVisible = getVisibility(bladeState).toVar();
    const currentScale = getScale(bladeState);
    const originalScale = getOriginalScale(bladeState);
    const clipPosition = sceneManager.uCameraMatrix.mul(vec4(worldPos, 1));
    const isInFrustum = TSLUtils.computeFrustumVisibility(
      clipPosition,
      sceneManager.uFx,
      sceneManager.uFy,
      config.BLADE_BOUNDING_SPHERE_RADIUS,
      uniforms.uCullPadNDCX,
      uniforms.uCullPadNDCYNear,
      uniforms.uCullPadNDCYFar,
    );
    const cacheValidity = getTerrainCacheValidity(bladeState).mul(
      float(1).sub(isWrapped),
    );
    bladeState.assign(setVisibility(bladeState, 0));
    bladeState.assign(setTerrainCacheValidity(bladeState, cacheValidity));

    If(isInFrustum, () => {
      const distanceSquared = wrappedOffset.xz.dot(wrappedOffset.xz);
      const previousKeep = wasVisible.mul(float(1).sub(isWrapped));
      const passesStochasticThinning = this.computeStochasticKeep(
        worldPos,
        distanceSquared,
        currentScale.mul(config.BLADE_HEIGHT),
        previousKeep,
      );

      If(passesStochasticThinning, () => {
        const needsTerrainRefresh = float(1).sub(cacheValidity);

        If(needsTerrainRefresh, () => {
          const mapUv = TSLUtils.computeMapUvByPosition(worldPos.xz);
          const terrainMaps = texture(
            assetManager.resources.terrainMaps,
            mapUv,
          );
          const grassScale = terrainMaps.g
            .sub(0.25)
            .div(1 - 0.25)
            .clamp();
          const heightUv = vec2(mapUv.x, float(1).sub(mapUv.y));
          const yOffset = texture(assetManager.resources.heightmap, heightUv).r;

          cachedGrassScale.assign(grassScale);
          bladeTerrain.assign(setYOffset(bladeTerrain, yOffset));
          bladeTerrain.assign(
            setBakedShadowFactor(bladeTerrain, terrainMaps.r),
          );
          bladeState.assign(setTerrainCacheValidity(bladeState, 1));
        });

        const baseScale = originalScale.mul(cachedGrassScale);
        const isTerrainVisible = step(config.MIN_VISIBLE_SCALE, baseScale);

        If(isTerrainVisible, () => {
          bladeState.assign(setVisibility(bladeState, 1));
          const recoveryFactor = min(
            uniforms.uTrailGrowthRate.mul(gameDeltaTime),
            1,
          );
          const recoveredScale = mix(currentScale, baseScale, recoveryFactor);
          const didAppear = float(1).sub(wasVisible);
          const shouldReset = max(isWrapped, didAppear);
          const scaleBeforeTrail = mix(recoveredScale, baseScale, shouldReset);

          const yOffset = getYOffset(bladeTerrain);

          const playerOffset = wrappedOffset.xz;

          const isPlayerGrounded = step(
            0.1,
            float(1).sub(uniforms.uPlayerPosition.y.sub(yOffset)),
          );

          const contact = float(1)
            .sub(smoothstep(0, uniforms.uTrailRadiusSquared, distanceSquared))
            .mul(isPlayerGrounded);

          const crushedScale = min(baseScale, uniforms.uTrailMinScale);
          const crushingFactor = min(
            uniforms.uKDown.mul(contact).mul(gameDeltaTime),
            1,
          );
          const nextScale = mix(scaleBeforeTrail, crushedScale, crushingFactor);
          bladeState.assign(setScale(bladeState, nextScale));

          const trailDirection = playerOffset
            .mul(uniforms.uTrailRadius)
            .div(max(distanceSquared, uniforms.uTrailRadiusSquared));
          const trailAmount = float(1)
            .sub(nextScale.div(max(baseScale, config.MIN_VISIBLE_SCALE)))
            .clamp();
          const trailBend = trailDirection.mul(
            trailAmount.mul(uniforms.uTrailBendStrength),
          );

          const positionNoise = getPositionNoise(bladeTerrain);
          const windState = this.windState.element(instanceIndex);
          const bendXZ = vec2(0).toVar();
          const transitionInner = uniforms.uDetailedWindRadius;
          const transitionOuter = transitionInner.add(
            config.DETAILED_WIND_TRANSITION_WIDTH,
          );
          const transitionInnerSquared = transitionInner.mul(transitionInner);
          const transitionOuterSquared = transitionOuter.mul(transitionOuter);
          const isFarOnly = step(transitionOuterSquared, distanceSquared);

          If(isFarOnly, () => {
            const distantWind = this.computeDistantWind(worldPos);
            const distantWindXZ = distantWind.xy.clamp(-2, 2);
            bendXZ.assign(
              this.computeDistantBladeDeformation(
                distantWindXZ,
                distantWind.z,
                nextScale,
              ),
            );
          }).Else(() => {
            const newWind = this.computeWind(
              windState,
              worldPos,
              positionNoise,
              shouldReset,
            );
            const windXZ = newWind.xy.clamp(-2, 2);
            windState.assign(windXZ);
            const detailedBend = this.computeBladeDeformation(
              windXZ,
              newWind.z,
              worldPos,
              nextScale,
            );
            bendXZ.assign(detailedBend);

            const usesTransition = step(
              transitionInnerSquared,
              distanceSquared,
            );
            If(usesTransition, () => {
              const distantWind = this.computeDistantWind(worldPos);
              const distantWindXZ = distantWind.xy.clamp(-2, 2);
              const distantBend = this.computeDistantBladeDeformation(
                distantWindXZ,
                distantWind.z,
                nextScale,
              );
              const transitionMix = smoothstep(
                transitionInnerSquared,
                transitionOuterSquared,
                distanceSquared,
              );
              bendXZ.assign(mix(detailedBend, distantBend, transitionMix));
            });
          });

          bladeState.assign(setBend(bladeState, bendXZ.add(trailBend)));

          // 0, 1 or 2 without branching: each radius passed contributes one step
          const cameraOffset = worldPos.xz.sub(
            sceneManager.uPlayerCameraPosition.xz,
          );
          const cameraDistanceSquared = cameraOffset.dot(cameraOffset);
          const isPastNearRadius = step(
            uniforms.uLod0RadiusSquared,
            cameraDistanceSquared,
          );
          const isPastMidRadius = step(
            uniforms.uLod1RadiusSquared,
            cameraDistanceSquared,
          );
          const lodIndex = uint(isPastNearRadius.add(isPastMidRadius)).mul(
            uint(uniforms.uLodEnabled),
          );

          const drawArgsBase = lodIndex.mul(config.INDIRECT_ARGS_STRIDE);
          const instanceCountIndex = drawArgsBase.add(
            config.INSTANCE_COUNT_INDEX,
          );
          const drawIndex = atomicAdd(
            this.atomicIndirectDrawArguments.element(instanceCountIndex),
            1,
          );

          const lodRegionStart = lodIndex.mul(config.COUNT);
          const drawSlot = lodRegionStart.add(drawIndex);
          this.visibleIndices.element(drawSlot).assign(instanceIndex);
        });
      });
    });
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  // only the instance counts are cleared; indexCount and firstInstance are set
  // once at construction and must survive every frame
  computeResetInstanceCount = Fn(() => {
    // unrolled at graph build time, no GPU branching
    for (let lod = 0; lod < config.LOD_COUNT; lod++) {
      const argsBase = lod * config.INDIRECT_ARGS_STRIDE;
      const instanceCountIndex = argsBase + config.INSTANCE_COUNT_INDEX;
      atomicStore(
        this.atomicIndirectDrawArguments.element(instanceCountIndex),
        0,
      );
    }
  })().compute(1, [1]); // one invocation in a one-thread workgroup

  private computeStochasticKeep = Fn<StochasticKeepArgs, Node<"float">>(
    ([worldPos, distanceSquared, bladeHeight, previousKeep]) => {
      const fullDensityRadiusSquared = uniforms.uFullDensityRadius.mul(
        uniforms.uFullDensityRadius,
      );
      const densityFalloffRadiusSquared = uniforms.uDensityFalloffRadius.mul(
        uniforms.uDensityFalloffRadius,
      );
      const distanceFactor = distanceSquared
        .sub(fullDensityRadiusSquared)
        .div(
          max(
            densityFalloffRadiusSquared.sub(fullDensityRadiusSquared),
            EPSILON,
          ),
        )
        .clamp();
      const distanceKeep = mix(1, uniforms.uFarDensity, distanceFactor);
      const cameraDistance = worldPos
        .distance(sceneManager.uPlayerCameraPosition)
        .max(EPSILON);
      const projectedBladeHeight = sceneManager.uFy
        .mul(bladeHeight)
        .div(cameraDistance);
      const screenKeep = smoothstep(
        uniforms.uProjectedHeightMin,
        uniforms.uProjectedHeightFull,
        projectedBladeHeight,
      );
      const keepProbability = distanceKeep.mul(screenKeep);
      const cell = floor(worldPos.xz.div(config.SPACING));
      const randomThreshold = hash(cell.x.mul(12.9898).add(cell.y.mul(78.233)));
      const enterThreshold = randomThreshold
        .add(uniforms.uStochasticHysteresis)
        .clamp();
      const stayThreshold = randomThreshold
        .sub(uniforms.uStochasticHysteresis)
        .clamp(EPSILON, 1);
      const enterKeep = step(enterThreshold, keepProbability);
      const stayKeep = step(stayThreshold, keepProbability);
      return mix(enterKeep, stayKeep, previousKeep);
    },
  );

  // cubic bezier with P0 = 0 and P3 = 1 over normalized blade height
  private computeWindResponse = Fn<[scaleY: Node<"float">], Node<"float">>(
    ([scaleY]) => {
      const t = scaleY.div(uniforms.uBladeMaxScale).clamp();
      const inverse = float(1).sub(t);
      const p1Term = inverse
        .mul(inverse)
        .mul(t)
        .mul(3)
        .mul(uniforms.uWindCurveP1);
      const p2Term = inverse.mul(t).mul(t).mul(3).mul(uniforms.uWindCurveP2);
      return p1Term.add(p2Term).add(t.mul(t).mul(t));
    },
  );

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
      .mul(uniforms.uWindUvScale.mul(0.01))
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
    const scaleWindFactor = this.computeWindResponse(scaleY);
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
      swayA.add(swayB).mul(uniforms.uAmbientSwayStrength).mul(swayEnvelope),
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
      .add(ambientOffset.mul(scaleWindFactor))
      .add(perpendicularWind.mul(flutter));
  });

  private computeDistantWind = Fn<[worldPos: Node<"vec3">], Node<"vec3">>(
    ([worldPos]) => {
      const baseDir = windManager.uDirection;
      const windEvent = windManager.uIntensityDirectional;
      const phase = worldPos.x
        .mul(0.035)
        .add(worldPos.z.mul(0.025))
        .add(gameTime.mul(uniforms.uWindSpeed.mul(2.2)));
      const wave = sin(phase);
      const gust = wave.mul(0.5).add(0.5);
      const windFactor = uniforms.uWindStrength
        .mul(mix(uniforms.uWindLull, 1, gust))
        .mul(mix(1, 4, windEvent));

      return vec3(baseDir.mul(windFactor), gust);
    },
  );

  private computeDistantBladeDeformation = Fn<
    [windXZ: Node<"vec2">, gust: Node<"float">, scaleY: Node<"float">],
    Node<"vec2">
  >(([windXZ, gust, scaleY]) => {
    const scaleWindFactor = this.computeWindResponse(scaleY);
    const perpendicularWind = vec2(
      windManager.uDirection.y.negate(),
      windManager.uDirection.x,
    );
    const broadSway = gust.sub(0.5).mul(uniforms.uAmbientSwayStrength.mul(0.7));

    return windXZ
      .mul(uniforms.uBaseBending.mul(scaleWindFactor))
      .add(perpendicularWind.mul(broadSway.mul(scaleWindFactor)));
  });
}
