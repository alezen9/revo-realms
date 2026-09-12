import {
  EPSILON,
  Fn,
  TWO_PI,
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
  Return,
  remap,
  max,
  min,
  inverseSqrt,
  atomicAdd,
  atomicStore,
  storage,
  uint,
  Loop,
} from "three/tsl";
import { IndirectStorageBufferAttribute, type Node } from "three/webgpu";
import {
  assetManager,
  sceneManager,
  shadowManager,
  windManager,
} from "../../../systems";
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

type StochasticVisibilityArgs = [
  projectedHeightBase: Node<"float">,
  densityKeepProbability: Node<"float">,
  bladeScale: Node<"float">,
  previousVisibility: Node<"float">,
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
    const drawArgsBase = lod * INDIRECT_ARGS_STRIDE;
    const indexCountIndex = drawArgsBase + config.INDEX_COUNT_INDEX;
    const firstInstanceIndex = drawArgsBase + config.FIRST_INSTANCE_INDEX;

    drawArguments[indexCountIndex] = LOD_DRAW_PROFILES[lod].indexCount;
    drawArguments[firstInstanceIndex] = lod * BLADE_COUNT;
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
  private bladeState = instancedArray(config.BLADE_COUNT, "vec3");
  private shadowGeneration = instancedArray(config.CLUMP_COUNT, "float");

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
    this.shadowGeneration.value.name = "grass.shadowGeneration";
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
    this.shadowGeneration.element(instanceIndex).assign(-1);
    const row = floor(float(instanceIndex).div(config.CLUMPS_PER_SIDE));
    const col = float(instanceIndex).mod(config.CLUMPS_PER_SIDE);
    const randomX = hash(instanceIndex.add(4321));
    const randomZ = hash(instanceIndex.add(1234));

    const gridX = col.add(0.5).mul(config.CLUMP_SPACING);
    const gridZ = row.add(0.5).mul(config.CLUMP_SPACING);
    const jitterX = randomX.sub(0.5).mul(config.CLUMP_SPACING * 0.5);
    const jitterZ = randomZ.sub(0.5).mul(config.CLUMP_SPACING * 0.5);

    const offsetX = gridX.add(jitterX).sub(config.TILE_HALF_SIZE);
    const offsetZ = gridZ.add(jitterZ).sub(config.TILE_HALF_SIZE);

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
        const bladeLocalOffset = getBladeLocalOffset(bladeSlot, clumpRotation);

        const bladeOffset = vec2(offsetX, offsetZ).add(bladeLocalOffset);
        const normalizedBladeOffset = bladeOffset
          .add(config.TILE_HALF_SIZE)
          .div(config.TILE_SIZE);

        const noiseUv = normalizedBladeOffset.abs().fract();
        const noiseSample = texture(assetManager.resources.noiseAtlas, noiseUv);

        const scaleNoise = noiseSample.b;
        const shapedScaleNoise = scaleNoise.mul(scaleNoise);

        const randomScale = remap(
          shapedScaleNoise,
          0,
          1,
          uniforms.uBladeMinScale,
          uniforms.uBladeMaxScale,
        );

        bladeState.assign(vec3(0, 0, 1));
        bladeState.assign(setScale(bladeState, randomScale));
        bladeState.assign(setOriginalScale(bladeState, randomScale));
        bladeState.assign(setVisibility(bladeState, 0));
        bladeState.assign(setBend(bladeState, vec2(0)));
        bladeState.assign(setPositionNoise(bladeState, noiseSample.g));
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
    const maxWrapDelta = max(abs(wrapDelta.x), abs(wrapDelta.y));
    const isWrapped = step(config.TILE_HALF_SIZE, maxWrapDelta);
    const isNotWrapped = float(1).sub(isWrapped).toVar();

    clumpState.x = wrappedCenter.x;
    clumpState.y = wrappedCenter.y;

    const clumpWorldPos = vec3(
      wrappedCenter.x.add(uniforms.uPlayerPosition.x),
      uniforms.uPlayerPosition.y,
      wrappedCenter.y.add(uniforms.uPlayerPosition.z),
    );

    const clumpClipPosition = sceneManager.uCameraMatrix.mul(
      vec4(clumpWorldPos, 1),
    );

    const clumpBoundingRadius = float(config.BLADE_BOUNDING_SPHERE_RADIUS)
      .add(config.CLUMP_LOCAL_RADIUS)
      .mul(uniforms.uClumpBoundMultiplier);

    const isInFrustum = TSLUtils.computeFrustumVisibility(
      clumpClipPosition,
      sceneManager.uFx,
      sceneManager.uFy,
      clumpBoundingRadius,
      uniforms.uCullPadNDCX,
      uniforms.uCullPadNDCYNear,
      uniforms.uCullPadNDCYFar,
    );

    const terrainCacheValidity = getTerrainCacheValidity(clumpState)
      .mul(isNotWrapped)
      .toVar();

    clumpState.assign(
      setTerrainCacheValidity(clumpState, terrainCacheValidity),
    );

    If(isInFrustum.equal(0), () => {
      Return();
    });

    const needsTerrainRefresh = float(1).sub(terrainCacheValidity);

    If(needsTerrainRefresh, () => {
      const terrainMapUv = TSLUtils.computeMapUvByPosition(clumpWorldPos.xz);

      const terrainSample = texture(
        assetManager.resources.terrainMaps,
        terrainMapUv,
      );

      const terrainGrassScale = terrainSample.g
        .sub(0.25)
        .div(1 - 0.25)
        .clamp();

      const heightmapUv = vec2(terrainMapUv.x, float(1).sub(terrainMapUv.y));

      const terrainYOffset = texture(
        assetManager.resources.heightmap,
        heightmapUv,
      ).r;

      clumpState.z = terrainGrassScale;
      clumpState.assign(setYOffset(clumpState, terrainYOffset));
      clumpState.assign(setTerrainCacheValidity(clumpState, 1));
    });

    const hasGrass = step(
      config.MIN_VISIBLE_SCALE,
      clumpState.z.mul(uniforms.uBladeMaxScale),
    );

    If(hasGrass.equal(0), () => {
      Return();
    });

    const visibleBladeCount = uint(0).toVar();
    const clumpDistanceSquared = wrappedCenter.dot(wrappedCenter);

    const densityFalloffRangeSquared = max(
      uniforms.uDensityFalloffRadiusSquared.sub(
        uniforms.uFullDensityRadiusSquared,
      ),
      EPSILON,
    );

    const densityFalloffFactor = clumpDistanceSquared
      .sub(uniforms.uFullDensityRadiusSquared)
      .div(densityFalloffRangeSquared)
      .clamp();

    const densityKeepProbability = mix(
      1,
      uniforms.uFarDensity,
      densityFalloffFactor,
    ).toVar();

    const cameraOffset = clumpWorldPos.sub(sceneManager.uPlayerCameraPosition);

    const cameraDistanceSquared = cameraOffset.dot(cameraOffset);
    const minimumCameraDistanceSquared = EPSILON.mul(EPSILON);

    const inverseCameraDistance = inverseSqrt(
      max(cameraDistanceSquared, minimumCameraDistanceSquared),
    );

    const projectedHeightBase = sceneManager.uFy
      .mul(config.BLADE_HEIGHT)
      .mul(inverseCameraDistance)
      .toVar();

    const previousClumpVisibility = float(0).toVar();

    Loop(
      { start: 0, end: config.BLADES_PER_CLUMP, type: "uint" },
      ({ i: bladeSlot }) => {
        const bladeIndex = bladeSlot.mul(config.CLUMP_COUNT).add(instanceIndex);

        const bladeState = this.bladeState.element(bladeIndex);

        const previousVisibility = getVisibility(bladeState)
          .mul(isNotWrapped)
          .toVar();

        const originalScale = getOriginalScale(bladeState);
        const baseScale = originalScale.mul(clumpState.z);

        const passesStochasticVisibility = this.computeStochasticVisibility(
          projectedHeightBase,
          densityKeepProbability,
          baseScale,
          previousVisibility,
          bladeIndex,
        );

        const isTerrainVisible = step(config.MIN_VISIBLE_SCALE, baseScale);

        const isVisible = passesStochasticVisibility
          .mul(isTerrainVisible)
          .toVar();

        visibleBladeCount.addAssign(uint(isVisible));

        previousClumpVisibility.assign(
          max(previousClumpVisibility, previousVisibility),
        );

        bladeState.assign(
          setPreviousVisibility(bladeState, previousVisibility),
        );

        bladeState.assign(setVisibility(bladeState, isVisible));
      },
    );

    If(visibleBladeCount.equal(0), () => {
      Return();
    });

    const clumpRotation = getClumpRotation(clumpState).toVar();
    const shadowGeneration = this.shadowGeneration.element(instanceIndex);
    const shouldRefreshShadow = shadowGeneration
      .notEqual(shadowManager.uGroundGeneration)
      .or(isWrapped.greaterThan(0));

    If(shouldRefreshShadow, () => {
      Loop(
        { start: 0, end: config.BLADES_PER_CLUMP, type: "uint" },
        ({ i: bladeSlot }) => {
          const bladeLocalOffset = getBladeLocalOffset(
            bladeSlot,
            clumpRotation,
          );
          const bladeWorldXZ = wrappedCenter
            .add(bladeLocalOffset)
            .add(uniforms.uPlayerPosition.xz);
          const groundShadowFactor =
            shadowManager.getGroundFactor(bladeWorldXZ);
          const bladeIndex = bladeSlot
            .mul(config.CLUMP_COUNT)
            .add(instanceIndex);
          this.bladeState.element(bladeIndex).z.assign(groundShadowFactor);
        },
      );
      shadowGeneration.assign(shadowManager.uGroundGeneration);
    });

    const usesDistantWindOnly = step(
      uniforms.uDetailedWindOuterRadiusSquared,
      clumpDistanceSquared,
    );

    const usesWindTransition = step(
      uniforms.uDetailedWindRadiusSquared,
      clumpDistanceSquared,
    );

    const windTransitionFactor = float(0).toVar();
    const detailedWind = vec3(0).toVar();
    const distantWind = vec3(0).toVar();

    If(usesDistantWindOnly, () => {
      distantWind.assign(this.computeDistantWind(clumpWorldPos));
    }).Else(() => {
      const clumpWindState = this.clumpWind.element(instanceIndex);
      const shouldResetClumpWind = float(1).sub(previousClumpVisibility);

      const nextDetailedWind = this.computeDetailedWind(
        clumpWindState,
        clumpWorldPos,
        hash(instanceIndex.add(4327)),
        shouldResetClumpWind,
      );

      detailedWind.assign(nextDetailedWind);
      clumpWindState.assign(nextDetailedWind.xy);

      If(usesWindTransition, () => {
        distantWind.assign(this.computeDistantWind(clumpWorldPos));

        windTransitionFactor.assign(
          smoothstep(
            uniforms.uDetailedWindRadiusSquared,
            uniforms.uDetailedWindOuterRadiusSquared,
            clumpDistanceSquared,
          ),
        );
      });
    });

    const detailedWindXZ = detailedWind.xy.clamp(-2, 2).toVar();
    const distantWindXZ = distantWind.xy.clamp(-2, 2).toVar();

    const cameraOffsetXZ = cameraOffset.xz;
    const cameraDistanceXZSquared = cameraOffsetXZ.dot(cameraOffsetXZ);

    const isPastNearRadius = step(
      uniforms.uLod0RadiusSquared,
      cameraDistanceXZSquared,
    );

    const isPastMidRadius = step(
      uniforms.uLod1RadiusSquared,
      cameraDistanceXZSquared,
    );

    const lodIndex = uint(isPastNearRadius.add(isPastMidRadius));
    const drawArgsBase = lodIndex.mul(config.INDIRECT_ARGS_STRIDE);

    const instanceCountIndex = drawArgsBase.add(config.INSTANCE_COUNT_INDEX);

    const drawStartIndex = atomicAdd(
      this.atomicIndirectDrawArguments.element(instanceCountIndex),
      visibleBladeCount,
    );

    const lodVisibleRegionStart = lodIndex.mul(config.BLADE_COUNT);
    const visibleBladeOffset = uint(0).toVar();

    const terrainYOffset = getYOffset(clumpState);
    const playerHeightAboveTerrain =
      uniforms.uPlayerPosition.y.sub(terrainYOffset);

    const isPlayerGrounded = step(
      0.1,
      float(1).sub(playerHeightAboveTerrain),
    ).toVar();

    Loop(
      { start: 0, end: config.BLADES_PER_CLUMP, type: "uint" },
      ({ i: bladeSlot }) => {
        const bladeIndex = bladeSlot.mul(config.CLUMP_COUNT).add(instanceIndex);

        const bladeState = this.bladeState.element(bladeIndex);

        If(getVisibility(bladeState), () => {
          const bladeLocalOffset = getBladeLocalOffset(
            bladeSlot,
            clumpRotation,
          );

          const bladePlayerOffset = wrappedCenter.add(bladeLocalOffset);

          const playerDistanceSquared =
            bladePlayerOffset.dot(bladePlayerOffset);

          const currentScale = getScale(bladeState);
          const originalScale = getOriginalScale(bladeState);
          const baseScale = originalScale.mul(clumpState.z);

          const trailFalloff = smoothstep(
            0,
            uniforms.uTrailRadiusSquared,
            playerDistanceSquared,
          );

          const trailContact = float(1).sub(trailFalloff).mul(isPlayerGrounded);

          const crushedScale = min(baseScale, uniforms.uTrailMinScale);

          const targetScale = mix(baseScale, crushedScale, trailContact);

          const previousVisibility = getPreviousVisibility(bladeState);

          const scaleBeforeTrail = mix(
            baseScale,
            currentScale,
            previousVisibility,
          );

          const trailResponseRate = mix(
            uniforms.uTrailGrowthRate,
            uniforms.uKDown,
            trailContact,
          );

          const trailFactor = min(trailResponseRate.mul(gameDeltaTime), 1);

          const nextScale = mix(scaleBeforeTrail, targetScale, trailFactor);

          bladeState.assign(setScale(bladeState, nextScale));

          const trailDirectionDenominator = max(
            playerDistanceSquared,
            uniforms.uTrailRadiusSquared,
          );

          const trailDirection = bladePlayerOffset
            .mul(uniforms.uTrailRadius)
            .div(trailDirectionDenominator);

          const trailAmount = float(1).sub(nextScale.div(baseScale)).clamp();

          const trailBend = trailDirection.mul(
            trailAmount.mul(uniforms.uTrailBendStrength),
          );

          const windBendXZ = vec2(0).toVar();

          If(usesDistantWindOnly, () => {
            windBendXZ.assign(
              this.computeDistantBladeDeformation(
                distantWindXZ,
                distantWind.z,
                nextScale,
                bladeIndex,
              ),
            );
          }).Else(() => {
            const bladeWorldPos = vec3(
              bladePlayerOffset.x.add(uniforms.uPlayerPosition.x),
              uniforms.uPlayerPosition.y,
              bladePlayerOffset.y.add(uniforms.uPlayerPosition.z),
            );

            const detailedBend = this.computeBladeDeformation(
              detailedWindXZ,
              detailedWind.z,
              bladeWorldPos,
              nextScale,
              bladeIndex,
            );

            windBendXZ.assign(detailedBend);

            If(usesWindTransition, () => {
              const distantBend = this.computeDistantBladeDeformation(
                distantWindXZ,
                distantWind.z,
                nextScale,
                bladeIndex,
              );

              windBendXZ.assign(
                mix(detailedBend, distantBend, windTransitionFactor),
              );
            });
          });

          const totalBendXZ = windBendXZ.add(trailBend);

          bladeState.assign(setBend(bladeState, totalBendXZ));

          const drawSlot = lodVisibleRegionStart
            .add(drawStartIndex)
            .add(visibleBladeOffset);

          this.visibleIndices.element(drawSlot).assign(bladeIndex);

          visibleBladeOffset.addAssign(1);
        });
      },
    );
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

  private computeStochasticVisibility = Fn<
    StochasticVisibilityArgs,
    Node<"float">
  >(
    ([
      projectedHeightBase,
      densityKeepProbability,
      bladeScale,
      previousVisibility,
      bladeIndex,
    ]) => {
      const projectedBladeHeight = projectedHeightBase.mul(bladeScale);

      const screenKeepProbability = smoothstep(
        uniforms.uProjectedHeightMin,
        uniforms.uProjectedHeightFull,
        projectedBladeHeight,
      );

      const keepProbability = densityKeepProbability.mul(screenKeepProbability);

      const randomThreshold = hash(bladeIndex.add(9176));

      const enterThreshold = randomThreshold.add(
        uniforms.uStochasticHysteresis,
      );

      const stayThreshold = max(
        randomThreshold.sub(uniforms.uStochasticHysteresis),
        EPSILON,
      );

      const enterVisibility = step(enterThreshold, keepProbability);

      const stayVisibility = step(stayThreshold, keepProbability);

      return mix(enterVisibility, stayVisibility, previousVisibility);
    },
  );

  // cubic bezier with P0 = 0 and P3 = 1 over normalized blade height
  private computeWindResponse = Fn<[bladeScale: Node<"float">], Node<"float">>(
    ([bladeScale]) => {
      const t = bladeScale.div(uniforms.uBladeMaxScale).clamp();

      const linear = uniforms.uWindCurveP1.mul(3);

      const quadratic = uniforms.uWindCurveP2
        .mul(3)
        .sub(uniforms.uWindCurveP1.mul(6));

      const cubic = uniforms.uWindCurveP1
        .mul(3)
        .sub(uniforms.uWindCurveP2.mul(3))
        .add(1);

      return t.mul(linear.add(t.mul(quadratic.add(t.mul(cubic)))));
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
    const windDirection = windManager.uDirection;
    const windEventIntensity = windManager.uIntensityDirectional;

    const perpendicularDirection = vec2(
      windDirection.y.negate(),
      windDirection.x,
    );

    const noiseScrollDirection = perpendicularDirection
      .mul(0.3717)
      .sub(windDirection);

    const windNoiseUv = worldPos.xz
      .mul(uniforms.uWindUvScale.mul(0.01))
      .add(noiseScrollDirection.mul(uniforms.uWindSpeed.mul(gameTime)));

    const windNoise = texture(assetManager.resources.noiseAtlas, windNoiseUv);

    const fastGust = sin(windNoise.g.mul(18.85)).mul(0.5).add(0.5);

    const gustField = mix(windNoise.r, fastGust, windEventIntensity);

    const gustThreshold = float(1).sub(uniforms.uWindGustCoverage);

    const gust = smoothstep(gustThreshold, gustThreshold.add(0.25), gustField);

    const windStrength = uniforms.uWindStrength
      .mul(mix(uniforms.uWindLull, 1, gust))
      .mul(mix(1, 4, windEventIntensity));

    const directionalVeer = windNoise.g
      .sub(0.5)
      .mul(2)
      .mul(uniforms.uWindEddyStrength);

    const targetDirection = windDirection.add(
      perpendicularDirection.mul(directionalVeer),
    );

    const targetWindXZ = targetDirection.mul(windStrength);

    const responseRate = mix(3.5, 11, positionNoise).mul(mix(0.3, 1, gust));

    const responseFactor = min(responseRate.mul(gameDeltaTime), 1);

    const windDelta = targetWindXZ.sub(previousWindXZ);

    const smoothedWindXZ = previousWindXZ.add(windDelta.mul(responseFactor));

    const nextWindXZ = mix(smoothedWindXZ, targetWindXZ, resetWind);

    return vec3(nextWindXZ, gust);
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
    const randomPhase = bladeSeed.mul(6.2825).sub(3.14125);
    const swayRateNoise = bladeSeed.mul(31.7).fract();

    const scaleWindResponse = this.computeWindResponse(scaleY);

    const windIntensity = windXZ.dot(windXZ).mul(3.5).clamp();

    const gustInfluence = smoothstep(0.2, 1, gust);

    const windActivity = max(windIntensity, gustInfluence.mul(0.45));

    const swayEnvelope = mix(0.75, 1.35, windActivity);
    const heightPhase = swayEnvelope.mul(0.55);
    const swayRate = mix(0.7, 1.45, swayRateNoise);

    const swayAPhase = gameTime
      .mul(swayRate.mul(1.35))
      .add(randomPhase)
      .add(heightPhase);

    const swayA = sin(swayAPhase);

    const swayBPhase = gameTime
      .mul(swayRate.mul(2.15))
      .add(worldPos.x.mul(0.17))
      .add(worldPos.z.mul(0.11))
      .add(randomPhase.mul(1.7))
      .add(heightPhase.mul(1.6));

    const swayB = sin(swayBPhase).mul(0.45);

    const ambientAngle = bladeSeed.mul(53.3).fract().mul(TWO_PI);

    const ambientDirection = vec2(cos(ambientAngle), sin(ambientAngle));

    const ambientStrength = swayA
      .add(swayB)
      .mul(uniforms.uAmbientSwayStrength)
      .mul(swayEnvelope);

    const ambientOffset = ambientDirection.mul(ambientStrength);

    const perpendicularDirection = vec2(
      windManager.uDirection.y.negate(),
      windManager.uDirection.x,
    );

    const bendStrength = uniforms.uBaseBending.mul(scaleWindResponse);

    const flutterPhase = bladeSeed
      .mul(97.13)
      .fract()
      .mul(TWO_PI)
      .add(worldPos.x.mul(0.13))
      .add(worldPos.z.mul(0.07));

    const flutterTime = gameTime.mul(uniforms.uWindSpeed.mul(1.7));

    const flutter = sin(
      flutterTime.add(flutterPhase.mul(1.3)).add(heightPhase.mul(2.2)),
    )
      .mul(0.025)
      .mul(windActivity)
      .mul(bendStrength);

    const windBend = windXZ.mul(bendStrength);
    const ambientBend = ambientOffset.mul(scaleWindResponse);
    const flutterBend = perpendicularDirection.mul(flutter);

    return windBend.add(ambientBend).add(flutterBend);
  });

  private computeDistantWind = Fn<[worldPos: Node<"vec3">], Node<"vec3">>(
    ([worldPos]) => {
      const windDirection = windManager.uDirection;
      const windEventIntensity = windManager.uIntensityDirectional;

      const spatialPhase = worldPos.x.mul(0.035).add(worldPos.z.mul(0.025));

      const temporalPhase = gameTime.mul(uniforms.uWindSpeed.mul(2.2));

      const phase = spatialPhase.add(temporalPhase);
      const wave = sin(phase);
      const gust = wave.mul(0.5).add(0.5);

      const windStrength = uniforms.uWindStrength
        .mul(mix(uniforms.uWindLull, 1, gust))
        .mul(mix(1, 4, windEventIntensity));

      return vec3(windDirection.mul(windStrength), gust);
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
    const scaleWindResponse = this.computeWindResponse(scaleY);

    const perpendicularDirection = vec2(
      windManager.uDirection.y.negate(),
      windManager.uDirection.x,
    );

    const bladeSeed = hash(bladeIndex.add(613));
    const strengthVariation = mix(0.88, 1.12, bladeSeed);

    const flutterPhase = bladeSeed.mul(97.13).fract().mul(TWO_PI);

    const flutterTime = gameTime.mul(uniforms.uWindSpeed.mul(1.4));

    const flutter = sin(flutterTime.add(flutterPhase)).mul(
      uniforms.uAmbientSwayStrength.mul(0.2),
    );

    const broadSway = gust
      .sub(0.5)
      .mul(uniforms.uAmbientSwayStrength.mul(0.7))
      .add(flutter);

    const bendStrength = uniforms.uBaseBending
      .mul(scaleWindResponse)
      .mul(strengthVariation);

    const windBend = windXZ.mul(bendStrength);

    const broadSwayBend = perpendicularDirection.mul(
      broadSway.mul(scaleWindResponse),
    );

    return windBend.add(broadSwayBend);
  });
}
