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
  Loop,
} from "three/tsl";
import { IndirectStorageBufferAttribute, type Node } from "three/webgpu";
import { assetManager, sceneManager, windManager } from "../../../systems";
import { TSLUtils } from "../../../utils/TSLUtils";
import { gameDeltaTime, gameTime } from "../../../utils/GameTime";
import { config, uniforms } from "./config";
import {
  getBladeLocalOffset,
  getClumpRotation,
  getOriginalScale,
  getPreviousVisibility,
  getScale,
  getTerrainCacheValidity,
  getVisibility,
  getYOffset,
  setBakedShadowFactor,
  setBend,
  setClumpOrientation,
  setOriginalScale,
  setPositionNoise,
  setPreviousVisibility,
  setScale,
  setTerrainCacheValidity,
  setVisibility,
  setYOffset,
} from "./GrassBladeData";

type StochasticKeepArgs = [
  projectedHeightBase: Node<"float">,
  distanceKeep: Node<"float">,
  bladeHeight: Node<"float">,
  previousKeep: Node<"float">,
  bladeIndex: Node<"uint">,
];

// Draw arguments for every LOD live back to back in one buffer, so the compute
// pass binds a single storage buffer instead of one per LOD. firstInstance points
// each draw at its own region of the visible index list, which is how the material
// resolves its LOD without being told: instance_index starts at firstInstance.
const createIndirectDrawArguments = () => {
  const { LOD_DRAW_PROFILES, LOD_COUNT, INDIRECT_ARGS_STRIDE, BLADE_COUNT } =
    config;
  const drawArguments = new Uint32Array(LOD_COUNT * INDIRECT_ARGS_STRIDE);

  for (let lod = 0; lod < LOD_COUNT; lod++) {
    const argsBase = lod * INDIRECT_ARGS_STRIDE;
    const argCountIdx = argsBase + config.INDEX_COUNT_INDEX;
    drawArguments[argCountIdx] = LOD_DRAW_PROFILES[lod].indexCount;
    const argFirstInstanceIdx = argsBase + config.FIRST_INSTANCE_INDEX;
    drawArguments[argFirstInstanceIdx] = lod * BLADE_COUNT;
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
  private clumpState = instancedArray(config.CLUMP_COUNT, "vec4");
  private clumpWind = instancedArray(config.CLUMP_COUNT, "vec2");
  private bladeState = instancedArray(config.BLADE_COUNT, "vec2");
  // one draw list per LOD, packed as regions of a single buffer; a blade appends
  // to exactly one region, so no region can exceed BLADE_COUNT
  private visibleIndices = instancedArray(
    config.BLADE_COUNT * config.LOD_COUNT,
    "uint",
  );

  constructor() {
    this.indirectDrawAttribute.name = "grass.indirectDrawArguments";
    this.clumpState.value.name = "grass.clumpState";
    this.clumpWind.value.name = "grass.clumpWind";
    this.bladeState.value.name = "grass.bladeState";
    this.visibleIndices.value.name = "grass.visibleIndices";
  }

  get bladeStateBuffer() {
    return this.bladeState;
  }

  get clumpStateBuffer() {
    return this.clumpState;
  }

  get visibleIndexBuffer() {
    return this.visibleIndices;
  }

  computeInit = Fn(() => {
    const clumpState = this.clumpState.element(instanceIndex);
    const row = floor(float(instanceIndex).div(config.CLUMPS_PER_SIDE));
    const col = float(instanceIndex).mod(config.CLUMPS_PER_SIDE);
    const randX = hash(instanceIndex.add(4321));
    const randZ = hash(instanceIndex.add(1234));
    const offsetX = col
      .add(0.5)
      .mul(config.CLUMP_SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randX.sub(0.5).mul(config.CLUMP_SPACING * 0.5));
    const offsetZ = row
      .add(0.5)
      .mul(config.CLUMP_SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randZ.sub(0.5).mul(config.CLUMP_SPACING * 0.5));
    clumpState.assign(vec4(offsetX, offsetZ, 0, 0));
    const orientation = floor(hash(instanceIndex.add(8371)).mul(4));
    clumpState.assign(setClumpOrientation(clumpState, orientation));
    this.clumpWind.element(instanceIndex).assign(vec2(0));
    const clumpRotation = getClumpRotation(clumpState);

    Loop(
      { start: 0, end: config.BLADES_PER_CLUMP, type: "uint" },
      ({ i: bladeSlot }) => {
        const bladeIndex = bladeSlot.mul(config.CLUMP_COUNT).add(instanceIndex);
        const bladeState = this.bladeState.element(bladeIndex);
        const localOffset = getBladeLocalOffset(bladeSlot, clumpRotation);
        const bladeOffset = vec2(offsetX, offsetZ).add(localOffset);
        const noiseUv = bladeOffset
          .add(config.TILE_HALF_SIZE)
          .div(config.TILE_SIZE)
          .abs()
          .fract();
        const noise = texture(assetManager.resources.noiseAtlas, noiseUv);
        const scaleNoise = noise.b;
        const shapedScaleNoise = scaleNoise.mul(scaleNoise);
        const randomScale = remap(
          shapedScaleNoise,
          0,
          1,
          uniforms.uBladeMinScale,
          uniforms.uBladeMaxScale,
        );
        bladeState.assign(vec2(0));
        bladeState.assign(setScale(bladeState, randomScale));
        bladeState.assign(setOriginalScale(bladeState, randomScale));
        bladeState.assign(setVisibility(bladeState, 0));
        bladeState.assign(setBend(bladeState, vec2(0)));
        bladeState.assign(setPositionNoise(bladeState, noise.g));
      },
    );
  })().compute(config.CLUMP_COUNT, [config.WORKGROUP_SIZE]);

  computeUpdate = Fn(() => {
    const clumpState = this.clumpState.element(instanceIndex);
    const previousCenter = clumpState.xy;
    const unwrappedCenter = previousCenter.sub(uniforms.uPlayerDeltaXZ);
    const wrappedOffsetX = mod(
      unwrappedCenter.x.add(config.TILE_HALF_SIZE),
      config.TILE_SIZE,
    ).sub(config.TILE_HALF_SIZE);
    const wrappedOffsetZ = mod(
      unwrappedCenter.y.add(config.TILE_HALF_SIZE),
      config.TILE_SIZE,
    ).sub(config.TILE_HALF_SIZE);
    const wrappedCenter = vec2(wrappedOffsetX, wrappedOffsetZ);

    const wrapDelta = wrappedCenter.sub(unwrappedCenter);
    const isWrapped = step(
      config.TILE_HALF_SIZE,
      max(abs(wrapDelta.x), abs(wrapDelta.y)),
    );

    clumpState.x = wrappedCenter.x;
    clumpState.y = wrappedCenter.y;

    const clumpWorldPos = vec3(
      wrappedCenter.x.add(uniforms.uPlayerPosition.x),
      uniforms.uPlayerPosition.y,
      wrappedCenter.y.add(uniforms.uPlayerPosition.z),
    );
    const clipPosition = sceneManager.uCameraMatrix.mul(vec4(clumpWorldPos, 1));
    const clumpBound = float(config.BLADE_BOUNDING_SPHERE_RADIUS)
      .add(config.CLUMP_LOCAL_RADIUS)
      .mul(uniforms.uClumpBoundMultiplier);
    const isInFrustum = TSLUtils.computeFrustumVisibility(
      clipPosition,
      sceneManager.uFx,
      sceneManager.uFy,
      clumpBound,
      uniforms.uCullPadNDCX,
      uniforms.uCullPadNDCYNear,
      uniforms.uCullPadNDCYFar,
    );
    const cacheValidity = getTerrainCacheValidity(clumpState)
      .mul(float(1).sub(isWrapped))
      .toVar();
    clumpState.assign(setTerrainCacheValidity(clumpState, cacheValidity));

    If(isInFrustum, () => {
      const needsTerrainRefresh = float(1).sub(cacheValidity);

      If(needsTerrainRefresh, () => {
        const mapUv = TSLUtils.computeMapUvByPosition(clumpWorldPos.xz);
        const terrainMaps = texture(assetManager.resources.terrainMaps, mapUv);
        const grassScale = terrainMaps.g
          .sub(0.25)
          .div(1 - 0.25)
          .clamp();
        const heightUv = vec2(mapUv.x, float(1).sub(mapUv.y));
        const yOffset = texture(assetManager.resources.heightmap, heightUv).r;

        clumpState.z = grassScale;
        clumpState.assign(setYOffset(clumpState, yOffset));
        clumpState.assign(setBakedShadowFactor(clumpState, terrainMaps.r));
        clumpState.assign(setTerrainCacheValidity(clumpState, 1));
      });

      const hasGrass = step(
        config.MIN_VISIBLE_SCALE,
        clumpState.z.mul(uniforms.uBladeMaxScale),
      );

      If(hasGrass, () => {
        const keptCount = uint(0).toVar();
        const clumpDistanceSquared = wrappedCenter.dot(wrappedCenter);
        const fullDensityRadiusSquared = uniforms.uFullDensityRadius.mul(
          uniforms.uFullDensityRadius,
        );
        const densityFalloffRadiusSquared = uniforms.uDensityFalloffRadius.mul(
          uniforms.uDensityFalloffRadius,
        );
        const distanceFactor = clumpDistanceSquared
          .sub(fullDensityRadiusSquared)
          .div(
            max(
              densityFalloffRadiusSquared.sub(fullDensityRadiusSquared),
              EPSILON,
            ),
          )
          .clamp();
        const distanceKeep = mix(
          1,
          uniforms.uFarDensity,
          distanceFactor,
        ).toVar();
        const cameraDistance = clumpWorldPos
          .distance(sceneManager.uPlayerCameraPosition)
          .max(EPSILON);
        const projectedHeightBase = sceneManager.uFy
          .mul(config.BLADE_HEIGHT)
          .div(cameraDistance)
          .toVar();

        const previousClumpVisibility = float(0).toVar();

        Loop(
          { start: 0, end: config.BLADES_PER_CLUMP, type: "uint" },
          ({ i: bladeSlot }) => {
            const bladeIndex = bladeSlot
              .mul(config.CLUMP_COUNT)
              .add(instanceIndex);
            const bladeState = this.bladeState.element(bladeIndex);
            const previousKeep = getVisibility(bladeState)
              .mul(float(1).sub(isWrapped))
              .toVar();
            const currentScale = getScale(bladeState);
            const passesStochasticThinning = this.computeStochasticKeep(
              projectedHeightBase,
              distanceKeep,
              currentScale,
              previousKeep,
              bladeIndex,
            );
            const originalScale = getOriginalScale(bladeState);
            const baseScale = originalScale.mul(clumpState.z);
            const isTerrainVisible = step(config.MIN_VISIBLE_SCALE, baseScale);
            const isSurvivor = passesStochasticThinning
              .mul(isTerrainVisible)
              .toVar();
            keptCount.addAssign(uint(isSurvivor));
            previousClumpVisibility.assign(
              max(previousClumpVisibility, previousKeep),
            );
            bladeState.assign(setPreviousVisibility(bladeState, previousKeep));
            bladeState.assign(setVisibility(bladeState, isSurvivor));
          },
        );

        If(keptCount, () => {
          const clumpRotation = getClumpRotation(clumpState).toVar();
          const transitionInner = uniforms.uDetailedWindRadius;
          const transitionOuter = transitionInner.add(
            config.DETAILED_WIND_TRANSITION_WIDTH,
          );
          const transitionInnerSquared = transitionInner.mul(transitionInner);
          const transitionOuterSquared = transitionOuter.mul(transitionOuter);
          const isFarOnly = step(transitionOuterSquared, clumpDistanceSquared);
          const detailedWind = vec3(0).toVar();
          const distantWind = vec3(0).toVar();
          const clumpWind = this.clumpWind.element(instanceIndex);
          const shouldResetWind = float(1).sub(previousClumpVisibility);

          If(isFarOnly, () => {
            distantWind.assign(this.computeDistantWind(clumpWorldPos));
          }).Else(() => {
            const nextDetailedWind = this.computeDetailedWind(
              clumpWind,
              clumpWorldPos,
              hash(instanceIndex.add(4327)),
              shouldResetWind,
            );
            detailedWind.assign(nextDetailedWind);
            clumpWind.assign(nextDetailedWind.xy);
            const usesTransition = step(
              transitionInnerSquared,
              clumpDistanceSquared,
            );
            If(usesTransition, () => {
              distantWind.assign(this.computeDistantWind(clumpWorldPos));
            });
          });

          const cameraOffset = clumpWorldPos.xz.sub(
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
          const lodIndex = uint(isPastNearRadius.add(isPastMidRadius));
          const drawArgsBase = lodIndex.mul(config.INDIRECT_ARGS_STRIDE);
          const instanceCountIndex = drawArgsBase.add(
            config.INSTANCE_COUNT_INDEX,
          );
          const drawIndex = atomicAdd(
            this.atomicIndirectDrawArguments.element(instanceCountIndex),
            keptCount,
          );
          const lodRegionStart = lodIndex.mul(config.BLADE_COUNT);
          const localDrawIndex = uint(0).toVar();

          Loop(
            { start: 0, end: config.BLADES_PER_CLUMP, type: "uint" },
            ({ i: bladeSlot }) => {
              const bladeIndex = bladeSlot
                .mul(config.CLUMP_COUNT)
                .add(instanceIndex);
              const bladeState = this.bladeState.element(bladeIndex);
              If(getVisibility(bladeState), () => {
                const localOffset = getBladeLocalOffset(
                  bladeSlot,
                  clumpRotation,
                );
                const playerOffset = wrappedCenter.add(localOffset);
                const bladeWorldPos = vec3(
                  playerOffset.x.add(uniforms.uPlayerPosition.x),
                  uniforms.uPlayerPosition.y,
                  playerOffset.y.add(uniforms.uPlayerPosition.z),
                );
                const distanceSquared = playerOffset.dot(playerOffset);
                const currentScale = getScale(bladeState);
                const originalScale = getOriginalScale(bladeState);
                const baseScale = originalScale.mul(clumpState.z);
                const recoveryFactor = min(
                  uniforms.uTrailGrowthRate.mul(gameDeltaTime),
                  1,
                );
                const recoveredScale = mix(
                  currentScale,
                  baseScale,
                  recoveryFactor,
                );
                const shouldReset = float(1).sub(
                  getPreviousVisibility(bladeState),
                );
                const scaleBeforeTrail = mix(
                  recoveredScale,
                  baseScale,
                  shouldReset,
                );
                const yOffset = getYOffset(clumpState);
                const isPlayerGrounded = step(
                  0.1,
                  float(1).sub(uniforms.uPlayerPosition.y.sub(yOffset)),
                );
                const contact = float(1)
                  .sub(
                    smoothstep(
                      0,
                      uniforms.uTrailRadiusSquared,
                      distanceSquared,
                    ),
                  )
                  .mul(isPlayerGrounded);
                const crushedScale = min(baseScale, uniforms.uTrailMinScale);
                const crushingFactor = min(
                  uniforms.uKDown.mul(contact).mul(gameDeltaTime),
                  1,
                );
                const nextScale = mix(
                  scaleBeforeTrail,
                  crushedScale,
                  crushingFactor,
                );
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
                const bendXZ = vec2(0).toVar();

                If(isFarOnly, () => {
                  bendXZ.assign(
                    this.computeDistantBladeDeformation(
                      distantWind.xy.clamp(-2, 2),
                      distantWind.z,
                      nextScale,
                      bladeIndex,
                    ),
                  );
                }).Else(() => {
                  const detailedBend = this.computeBladeDeformation(
                    detailedWind.xy.clamp(-2, 2),
                    detailedWind.z,
                    bladeWorldPos,
                    nextScale,
                    bladeIndex,
                  );
                  bendXZ.assign(detailedBend);
                  const usesTransition = step(
                    transitionInnerSquared,
                    clumpDistanceSquared,
                  );
                  If(usesTransition, () => {
                    const distantBend = this.computeDistantBladeDeformation(
                      distantWind.xy.clamp(-2, 2),
                      distantWind.z,
                      nextScale,
                      bladeIndex,
                    );
                    const transitionMix = smoothstep(
                      transitionInnerSquared,
                      transitionOuterSquared,
                      clumpDistanceSquared,
                    );
                    bendXZ.assign(
                      mix(detailedBend, distantBend, transitionMix),
                    );
                  });
                });

                bladeState.assign(setBend(bladeState, bendXZ.add(trailBend)));
                const drawSlot = lodRegionStart
                  .add(drawIndex)
                  .add(localDrawIndex);
                this.visibleIndices.element(drawSlot).assign(bladeIndex);
                localDrawIndex.addAssign(1);
              });
            },
          );
        });
      });
    });
  })().compute(config.CLUMP_COUNT, [config.WORKGROUP_SIZE]);

  // only the instance counts are cleared; indexCount and firstInstance are set
  // once at construction and must survive every frame
  computeResetInstanceCount = Fn(() => {
    Loop(
      { start: 0, end: config.LOD_COUNT, type: "uint" },
      ({ i: lodIndex }) => {
        const instanceCountIndex = lodIndex
          .mul(config.INDIRECT_ARGS_STRIDE)
          .add(config.INSTANCE_COUNT_INDEX);
        atomicStore(
          this.atomicIndirectDrawArguments.element(instanceCountIndex),
          0,
        );
      },
    );
  })().compute(1, [1]); // one invocation in a one-thread workgroup

  private computeStochasticKeep = Fn<StochasticKeepArgs, Node<"float">>(
    ([
      projectedHeightBase,
      distanceKeep,
      bladeHeight,
      previousKeep,
      bladeIndex,
    ]) => {
      const projectedBladeHeight = projectedHeightBase.mul(bladeHeight);
      const screenKeep = smoothstep(
        uniforms.uProjectedHeightMin,
        uniforms.uProjectedHeightFull,
        projectedBladeHeight,
      );
      const keepProbability = distanceKeep.mul(screenKeep);
      const randomThreshold = hash(bladeIndex.add(9176));
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

  private computeDetailedWind = Fn<
    [
      previousWindXZ: Node<"vec2">,
      worldPos: Node<"vec3">,
      positionNoise: Node<"float">,
      resetWind: Node<"float">,
    ],
    Node<"vec3">
  >(([previousWindXZ, worldPos, positionNoise, resetWind]) => {
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
    const damping = min(rate.mul(gameDeltaTime), 1);
    const dampedWind = previousWindXZ.add(
      target.sub(previousWindXZ).mul(damping),
    );
    const nextWind = mix(dampedWind, target, resetWind);

    return vec3(nextWind, gust);
  });

  private computeBladeDeformation = Fn<
    [
      windXZ: Node<"vec2">,
      gust: Node<"float">,
      worldPos: Node<"vec3">,
      scaleY: Node<"float">,
      bladeIndex: Node<"uint">,
    ],
    Node<"vec2">
  >(([windXZ, gust, worldPos, scaleY, bladeIndex]) => {
    const bladeSeed = hash(bladeIndex);
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
    [
      windXZ: Node<"vec2">,
      gust: Node<"float">,
      scaleY: Node<"float">,
      bladeIndex: Node<"uint">,
    ],
    Node<"vec2">
  >(([windXZ, gust, scaleY, bladeIndex]) => {
    const scaleWindFactor = this.computeWindResponse(scaleY);
    const perpendicularWind = vec2(
      windManager.uDirection.y.negate(),
      windManager.uDirection.x,
    );
    const bladeSeed = hash(bladeIndex.add(613));
    const strengthVariation = mix(0.88, 1.12, bladeSeed);
    const flutterPhase = bladeSeed.mul(97.13).fract().mul(PI2);
    const flutter = sin(
      gameTime.mul(uniforms.uWindSpeed.mul(1.4)).add(flutterPhase),
    ).mul(uniforms.uAmbientSwayStrength.mul(0.2));
    const broadSway = gust
      .sub(0.5)
      .mul(uniforms.uAmbientSwayStrength.mul(0.7))
      .add(flutter);

    return windXZ
      .mul(uniforms.uBaseBending.mul(scaleWindFactor).mul(strengthVariation))
      .add(perpendicularWind.mul(broadSway.mul(scaleWindFactor)));
  });
}
