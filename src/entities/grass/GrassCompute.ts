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
import { assets, stage } from "../../systems";
import { computeMapUvByPosition } from "../../shaders/mapping";
import { computeFrustumVisibility } from "../../shaders/frustum";
import { getGrassHeightFromMask, getGrassNoiseUv } from "./GrassShading";
import { gameDeltaTime } from "../../systems/time/gameTime";
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
import {
  computeBladeDeformation,
  computeDetailedWind,
  computeDistantBladeDeformation,
  computeDistantWind,
} from "./GrassWind";

const createClumpBuffer = () => instancedArray(config.CLUMP_COUNT, "vec4");
const createClumpWindBuffer = () => instancedArray(config.CLUMP_COUNT, "vec2");
const createBladeBuffer = () => instancedArray(config.BLADE_COUNT, "vec2");
const createVisibleIndexBuffer = () =>
  instancedArray(config.BLADE_COUNT * config.LOD_COUNT, "uint");
const createDrawArgumentsNode = (attribute: IndirectStorageBufferAttribute) =>
  storage(attribute, "uint", attribute.count).toAtomic();

type ClumpBuffer = ReturnType<typeof createClumpBuffer>;
type ClumpWindBuffer = ReturnType<typeof createClumpWindBuffer>;
type BladeBuffer = ReturnType<typeof createBladeBuffer>;
type VisibleIndexBuffer = ReturnType<typeof createVisibleIndexBuffer>;
type DrawArguments = ReturnType<typeof createDrawArgumentsNode>;
type ClumpState = ReturnType<ClumpBuffer["element"]>;
type ClumpWindState = ReturnType<ClumpWindBuffer["element"]>;

type StochasticVisibilityArgs = [
  projectedHeightBase: Node<"float">,
  densityKeepProbability: Node<"float">,
  bladeScale: Node<"float">,
  previousVisibility: Node<"float">,
  bladeIndex: Node<"uint">,
];

type ClumpWind = {
  detailedWind: Node<"vec3">;
  distantWind: Node<"vec3">;
  detailedWindXZ: Node<"vec2">;
  distantWindXZ: Node<"vec2">;
  windTransitionFactor: Node<"float">;
  usesDistantWindOnly: Node<"float">;
  usesWindTransition: Node<"float">;
};

// draw arguments for every LOD live back to back in one buffer, so the compute
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

const getBladeIndex = (bladeSlot: Node<"uint">) =>
  bladeSlot.mul(config.CLUMP_COUNT).add(instanceIndex);

const computeStochasticVisibility = Fn<StochasticVisibilityArgs, Node<"float">>(
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
    const enterThreshold = randomThreshold.add(uniforms.uStochasticHysteresis);
    const stayThreshold = max(
      randomThreshold.sub(uniforms.uStochasticHysteresis),
      EPSILON,
    );
    const enterVisibility = step(enterThreshold, keepProbability);
    const stayVisibility = step(stayThreshold, keepProbability);
    return mix(enterVisibility, stayVisibility, previousVisibility);
  },
);

const initClumps = Fn<
  [clumps: ClumpBuffer, clumpWinds: ClumpWindBuffer, blades: BladeBuffer],
  void
>(([clumps, clumpWinds, blades]) => {
  const clumpState = clumps.element(instanceIndex);
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

  clumpWinds.element(instanceIndex).assign(vec2(0));

  const clumpRotation = getClumpRotation(clumpState);

  Loop(
    { start: 0, end: config.BLADES_PER_CLUMP, type: "uint" },
    ({ i: bladeSlot }) => {
      const bladeState = blades.element(getBladeIndex(bladeSlot));
      const bladeLocalOffset = getBladeLocalOffset(bladeSlot, clumpRotation);

      const bladeOffset = vec2(offsetX, offsetZ).add(bladeLocalOffset);
      const normalizedBladeOffset = bladeOffset
        .add(config.TILE_HALF_SIZE)
        .div(config.TILE_SIZE);

      const noiseUv = normalizedBladeOffset.abs().fract();
      const noiseSample = texture(assets.resources.noiseAtlas, noiseUv);
      const colorNoise = texture(
        assets.resources.noiseAtlas,
        getGrassNoiseUv(bladeOffset.add(uniforms.uPlayerPosition.xz)),
      ).g;

      const scaleNoise = noiseSample.b;
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
      bladeState.assign(setPositionNoise(bladeState, colorNoise));
    },
  );
});

const wrapClumpAroundPlayer = (clumpState: ClumpState) => {
  const unwrappedCenter = clumpState.xy.sub(uniforms.uPlayerDeltaXZ);

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

  return { wrappedCenter, isNotWrapped };
};

const isClumpInFrustum = (clumpWorldPos: Node<"vec3">) => {
  const clumpClipPosition = stage.uCameraMatrix.mul(vec4(clumpWorldPos, 1));
  const clumpBoundingRadius = float(config.BLADE_BOUNDING_SPHERE_RADIUS)
    .add(config.CLUMP_LOCAL_RADIUS)
    .mul(uniforms.uClumpBoundMultiplier);

  return computeFrustumVisibility(
    clumpClipPosition,
    stage.uFx,
    stage.uFy,
    clumpBoundingRadius,
    uniforms.uCullPadNDCX,
    uniforms.uCullPadNDCYNear,
    uniforms.uCullPadNDCYFar,
  );
};

const refreshTerrainCache = (
  clumpState: ClumpState,
  blades: BladeBuffer,
  clumpWorldPos: Node<"vec3">,
  terrainCacheValidity: Node<"float">,
) => {
  const needsTerrainRefresh = float(1).sub(terrainCacheValidity);

  If(needsTerrainRefresh, () => {
    const terrainMapUv = computeMapUvByPosition(clumpWorldPos.xz);
    const terrainSample = texture(assets.resources.terrainMaps, terrainMapUv);
    const terrainGrassScale = getGrassHeightFromMask(terrainSample.g);
    const heightmapUv = vec2(terrainMapUv.x, float(1).sub(terrainMapUv.y));
    const terrainYOffset = texture(assets.resources.heightmap, heightmapUv).r;

    clumpState.z = terrainGrassScale;
    clumpState.assign(setYOffset(clumpState, terrainYOffset));
    clumpState.assign(setTerrainCacheValidity(clumpState, 1));

    const colorNoise = texture(
      assets.resources.noiseAtlas,
      getGrassNoiseUv(clumpWorldPos.xz),
    ).g.toVar();

    Loop(
      { start: 0, end: config.BLADES_PER_CLUMP, type: "uint" },
      ({ i: bladeSlot }) => {
        const bladeState = blades.element(getBladeIndex(bladeSlot));
        bladeState.assign(setPositionNoise(bladeState, colorNoise));
      },
    );
  });
};

const updateBladeVisibility = (
  clumpState: ClumpState,
  blades: BladeBuffer,
  isNotWrapped: Node<"float">,
  clumpDistanceSquared: Node<"float">,
  cameraOffset: Node<"vec3">,
) => {
  const visibleBladeCount = uint(0).toVar();

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

  const cameraDistanceSquared = cameraOffset.dot(cameraOffset);
  const minimumCameraDistanceSquared = EPSILON.mul(EPSILON);
  const inverseCameraDistance = inverseSqrt(
    max(cameraDistanceSquared, minimumCameraDistanceSquared),
  );
  const projectedHeightBase = stage.uFy
    .mul(config.BLADE_HEIGHT)
    .mul(inverseCameraDistance)
    .toVar();

  const previousClumpVisibility = float(0).toVar();

  Loop(
    { start: 0, end: config.BLADES_PER_CLUMP, type: "uint" },
    ({ i: bladeSlot }) => {
      const bladeIndex = getBladeIndex(bladeSlot);
      const bladeState = blades.element(bladeIndex);
      const previousVisibility = getVisibility(bladeState)
        .mul(isNotWrapped)
        .toVar();
      const baseScale = getOriginalScale(bladeState).mul(clumpState.z);

      const passesStochasticVisibility = computeStochasticVisibility(
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
      bladeState.assign(setPreviousVisibility(bladeState, previousVisibility));
      bladeState.assign(setVisibility(bladeState, isVisible));
    },
  );

  return { visibleBladeCount, previousClumpVisibility };
};

const computeClumpWind = (
  clumpWindState: ClumpWindState,
  clumpWorldPos: Node<"vec3">,
  clumpDistanceSquared: Node<"float">,
  previousClumpVisibility: Node<"float">,
): ClumpWind => {
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
    distantWind.assign(computeDistantWind(clumpWorldPos));
  }).Else(() => {
    const shouldResetClumpWind = float(1).sub(previousClumpVisibility);
    const nextDetailedWind = computeDetailedWind(
      clumpWindState,
      clumpWorldPos,
      hash(instanceIndex.add(4327)),
      shouldResetClumpWind,
    );

    detailedWind.assign(nextDetailedWind);
    clumpWindState.assign(nextDetailedWind.xy);

    If(usesWindTransition, () => {
      distantWind.assign(computeDistantWind(clumpWorldPos));
      windTransitionFactor.assign(
        smoothstep(
          uniforms.uDetailedWindRadiusSquared,
          uniforms.uDetailedWindOuterRadiusSquared,
          clumpDistanceSquared,
        ),
      );
    });
  });

  return {
    detailedWind,
    distantWind,
    detailedWindXZ: detailedWind.xy.clamp(-2, 2).toVar(),
    distantWindXZ: distantWind.xy.clamp(-2, 2).toVar(),
    windTransitionFactor,
    usesDistantWindOnly,
    usesWindTransition,
  };
};

const reserveDrawSlots = (
  drawArguments: DrawArguments,
  cameraOffset: Node<"vec3">,
  visibleBladeCount: Node<"uint">,
) => {
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
  const instanceCountIndex = lodIndex
    .mul(config.INDIRECT_ARGS_STRIDE)
    .add(config.INSTANCE_COUNT_INDEX);

  const drawStartIndex = atomicAdd(
    drawArguments.element(instanceCountIndex),
    visibleBladeCount,
  );
  const lodVisibleRegionStart = lodIndex.mul(config.BLADE_COUNT);
  return lodVisibleRegionStart.add(drawStartIndex);
};

const computeWindBend = (
  clumpWind: ClumpWind,
  bladePlayerOffset: Node<"vec2">,
  scale: Node<"float">,
  bladeIndex: Node<"uint">,
) => {
  const {
    detailedWind,
    distantWind,
    detailedWindXZ,
    distantWindXZ,
    windTransitionFactor,
    usesDistantWindOnly,
    usesWindTransition,
  } = clumpWind;
  const windBendXZ = vec2(0).toVar();

  If(usesDistantWindOnly, () => {
    windBendXZ.assign(
      computeDistantBladeDeformation(
        distantWindXZ,
        distantWind.z,
        scale,
        bladeIndex,
      ),
    );
  }).Else(() => {
    const bladeWorldPos = vec3(
      bladePlayerOffset.x.add(uniforms.uPlayerPosition.x),
      uniforms.uPlayerPosition.y,
      bladePlayerOffset.y.add(uniforms.uPlayerPosition.z),
    );
    const detailedBend = computeBladeDeformation(
      detailedWindXZ,
      detailedWind.z,
      bladeWorldPos,
      scale,
      bladeIndex,
    );

    windBendXZ.assign(detailedBend);

    If(usesWindTransition, () => {
      const distantBend = computeDistantBladeDeformation(
        distantWindXZ,
        distantWind.z,
        scale,
        bladeIndex,
      );
      windBendXZ.assign(mix(detailedBend, distantBend, windTransitionFactor));
    });
  });

  return windBendXZ;
};

const writeVisibleBlades = (
  clumpState: ClumpState,
  blades: BladeBuffer,
  visibleIndices: VisibleIndexBuffer,
  wrappedCenter: Node<"vec2">,
  clumpWind: ClumpWind,
  drawSlotStart: Node<"uint">,
) => {
  const clumpRotation = getClumpRotation(clumpState).toVar();
  const visibleBladeOffset = uint(0).toVar();
  const playerHeightAboveTerrain = uniforms.uPlayerPosition.y.sub(
    getYOffset(clumpState),
  );
  const isPlayerGrounded = step(
    0.1,
    float(1).sub(playerHeightAboveTerrain),
  ).toVar();

  Loop(
    { start: 0, end: config.BLADES_PER_CLUMP, type: "uint" },
    ({ i: bladeSlot }) => {
      const bladeIndex = getBladeIndex(bladeSlot);
      const bladeState = blades.element(bladeIndex);

      If(getVisibility(bladeState), () => {
        const bladeLocalOffset = getBladeLocalOffset(bladeSlot, clumpRotation);
        const bladePlayerOffset = wrappedCenter.add(bladeLocalOffset);
        const playerDistanceSquared = bladePlayerOffset.dot(bladePlayerOffset);

        const currentScale = getScale(bladeState);
        const baseScale = getOriginalScale(bladeState).mul(clumpState.z);
        const trailFalloff = smoothstep(
          0,
          uniforms.uTrailRadiusSquared,
          playerDistanceSquared,
        );
        const trailContact = float(1).sub(trailFalloff).mul(isPlayerGrounded);
        const crushedScale = min(baseScale, uniforms.uTrailMinScale);
        const targetScale = mix(baseScale, crushedScale, trailContact);
        const scaleBeforeTrail = mix(
          baseScale,
          currentScale,
          getPreviousVisibility(bladeState),
        );
        const trailResponseRate = mix(
          uniforms.uTrailGrowthRate,
          uniforms.uKDown,
          trailContact,
        );
        const trailFactor = min(trailResponseRate.mul(gameDeltaTime), 1);
        const nextScale = mix(scaleBeforeTrail, targetScale, trailFactor);

        bladeState.assign(setScale(bladeState, nextScale));

        const trailDirection = bladePlayerOffset
          .mul(uniforms.uTrailRadius)
          .div(max(playerDistanceSquared, uniforms.uTrailRadiusSquared));
        const trailAmount = float(1).sub(nextScale.div(baseScale)).clamp();
        const trailBend = trailDirection.mul(
          trailAmount.mul(uniforms.uTrailBendStrength),
        );
        const windBend = computeWindBend(
          clumpWind,
          bladePlayerOffset,
          nextScale,
          bladeIndex,
        );

        bladeState.assign(setBend(bladeState, windBend.add(trailBend)));
        visibleIndices
          .element(drawSlotStart.add(visibleBladeOffset))
          .assign(bladeIndex);
        visibleBladeOffset.addAssign(1);
      });
    },
  );
};

const updateClumps = Fn<
  [
    clumps: ClumpBuffer,
    clumpWinds: ClumpWindBuffer,
    blades: BladeBuffer,
    visibleIndices: VisibleIndexBuffer,
    drawArguments: DrawArguments,
  ],
  void
>(([clumps, clumpWinds, blades, visibleIndices, drawArguments]) => {
  const clumpState = clumps.element(instanceIndex);
  const { wrappedCenter, isNotWrapped } = wrapClumpAroundPlayer(clumpState);
  const clumpWorldPos = vec3(
    wrappedCenter.x.add(uniforms.uPlayerPosition.x),
    uniforms.uPlayerPosition.y,
    wrappedCenter.y.add(uniforms.uPlayerPosition.z),
  );
  const isInFrustum = isClumpInFrustum(clumpWorldPos);
  const terrainCacheValidity = getTerrainCacheValidity(clumpState)
    .mul(isNotWrapped)
    .toVar();
  clumpState.assign(setTerrainCacheValidity(clumpState, terrainCacheValidity));

  If(isInFrustum.equal(0), () => {
    Return();
  });

  refreshTerrainCache(clumpState, blades, clumpWorldPos, terrainCacheValidity);

  const hasGrass = step(
    config.MIN_VISIBLE_SCALE,
    clumpState.z.mul(uniforms.uBladeMaxScale),
  );
  If(hasGrass.equal(0), () => {
    Return();
  });

  const clumpDistanceSquared = wrappedCenter.dot(wrappedCenter);
  const cameraOffset = clumpWorldPos.sub(stage.uPlayerCameraPosition);
  const { visibleBladeCount, previousClumpVisibility } = updateBladeVisibility(
    clumpState,
    blades,
    isNotWrapped,
    clumpDistanceSquared,
    cameraOffset,
  );

  If(visibleBladeCount.equal(0), () => {
    Return();
  });

  const clumpWind = computeClumpWind(
    clumpWinds.element(instanceIndex),
    clumpWorldPos,
    clumpDistanceSquared,
    previousClumpVisibility,
  );
  const drawSlotStart = reserveDrawSlots(
    drawArguments,
    cameraOffset,
    visibleBladeCount,
  );
  writeVisibleBlades(
    clumpState,
    blades,
    visibleIndices,
    wrappedCenter,
    clumpWind,
    drawSlotStart,
  );
});

// only the instance counts are cleared; indexCount and firstInstance are set
// once at construction and must survive every frame
const resetInstanceCounts = Fn<[drawArguments: DrawArguments], void>(
  ([drawArguments]) => {
    Loop(
      { start: 0, end: config.LOD_COUNT, type: "uint" },
      ({ i: lodIndex }) => {
        const instanceCountIndex = lodIndex
          .mul(config.INDIRECT_ARGS_STRIDE)
          .add(config.INSTANCE_COUNT_INDEX);
        atomicStore(drawArguments.element(instanceCountIndex), 0);
      },
    );
  },
);

export class GrassCompute {
  readonly indirectDrawAttribute = new IndirectStorageBufferAttribute(
    createIndirectDrawArguments(),
    1,
  );
  readonly clumpState = createClumpBuffer();
  readonly bladeState = createBladeBuffer();
  // one draw list per LOD, packed as regions of a single buffer; a blade appends
  // to exactly one region, so no region can exceed BLADE_COUNT
  readonly visibleIndices = createVisibleIndexBuffer();
  readonly computeInit;
  readonly computeUpdate;
  readonly computeResetInstanceCount;
  private clumpWind = createClumpWindBuffer();

  constructor() {
    this.indirectDrawAttribute.name = "grass.indirectDrawArguments";
    this.clumpState.value.name = "grass.clumpState";
    this.clumpWind.value.name = "grass.clumpWind";
    this.bladeState.value.name = "grass.bladeState";
    this.visibleIndices.value.name = "grass.visibleIndices";

    const drawArguments = createDrawArgumentsNode(this.indirectDrawAttribute);
    const workgroup = [config.WORKGROUP_SIZE];
    this.computeInit = initClumps(
      this.clumpState,
      this.clumpWind,
      this.bladeState,
    ).compute(config.CLUMP_COUNT, workgroup);
    this.computeUpdate = updateClumps(
      this.clumpState,
      this.clumpWind,
      this.bladeState,
      this.visibleIndices,
      drawArguments,
    ).compute(config.CLUMP_COUNT, workgroup);
    this.computeResetInstanceCount = resetInstanceCounts(drawArguments).compute(
      1,
      [1],
    );
  }
}
