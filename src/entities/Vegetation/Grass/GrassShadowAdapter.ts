import { BufferGeometry, Float32BufferAttribute } from "three";
import type { Node } from "three/webgpu";
import {
  attribute,
  float,
  hash,
  mix,
  smoothstep,
  step,
  uint,
  vec3,
} from "three/tsl";
import { lightingManager } from "../../../systems";
import type { ShadowDeformedInstances } from "../../../systems/ShadowManager/ShadowCasterRegistry";
import { GrassBladeGeometry } from "./GrassBladeGeometry";
import {
  getBend,
  getBladeLocalOffset,
  getClumpRotation,
  getOriginalScale,
  getPositionNoise,
  getScale,
  getTerrainCacheValidity,
  getVisibility,
  getYOffset,
} from "./GrassBladeData";
import type { GrassCompute } from "./GrassCompute";
import { config, uniforms } from "./config";

// the single triangle has a base width of 0.28 before blade width scaling
const MIN_SHADOW_CARD_WIDTH = 0.125 / 0.28;

const createGrassShadowGeometry = () => {
  const source = new GrassBladeGeometry({
    nSegments: 1,
    bladeHeight: config.BLADE_HEIGHT,
  });
  const sourcePosition = source.getAttribute("position");
  const sourceUv = source.getAttribute("uv");
  const positions = new Float32Array(
    sourcePosition.count * config.BLADES_PER_CLUMP * 3,
  );
  const uvs = new Float32Array(sourceUv.count * config.BLADES_PER_CLUMP * 2);
  const bladeSlots = new Float32Array(
    sourcePosition.count * config.BLADES_PER_CLUMP,
  );
  for (let bladeSlot = 0; bladeSlot < config.BLADES_PER_CLUMP; bladeSlot++) {
    for (let vertex = 0; vertex < sourcePosition.count; vertex++) {
      const target = bladeSlot * sourcePosition.count + vertex;
      positions[target * 3] = sourcePosition.getX(vertex);
      positions[target * 3 + 1] = sourcePosition.getY(vertex);
      positions[target * 3 + 2] = sourcePosition.getZ(vertex);
      uvs[target * 2] = sourceUv.getX(vertex);
      uvs[target * 2 + 1] = sourceUv.getY(vertex);
      bladeSlots[target] = bladeSlot;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute(
    "grassBladeSlot",
    new Float32BufferAttribute(bladeSlots, 1),
  );
  source.dispose();
  return geometry;
};

const getBladeState = (
  compute: GrassCompute,
  clumpIndex: Node<"uint">,
  bladeSlot: Node<"uint">,
) => {
  const bladeIndex = bladeSlot.mul(config.CLUMP_COUNT).add(clumpIndex);
  const clumpState = compute.clumpStateBuffer.element(clumpIndex);
  const bladeState = compute.bladeStateBuffer.element(bladeIndex);
  const offset = getBladeLocalOffset(bladeSlot, getClumpRotation(clumpState));
  const bladeOffset = clumpState.xy.add(offset);
  return { bladeIndex, clumpState, bladeState, bladeOffset };
};

const getBladeWidth = (
  bladeState: Node<"vec2">,
  playerDistanceSquared: Node<"float">,
) => {
  const widthGain = mix(
    1,
    uniforms.uWidthFarGain,
    smoothstep(
      uniforms.uWidthNearRadiusSquared,
      uniforms.uWidthFarRadiusSquared,
      playerDistanceSquared,
    ),
  );
  return getPositionNoise(bladeState)
    .add(0.5)
    .mul(uniforms.uBladeWidth)
    .mul(widthGain);
};

const isBladeActive = (
  compute: GrassCompute,
  clumpIndex: Node<"uint">,
  bladeSlot: Node<"uint">,
) => {
  const clumpState = compute.clumpStateBuffer.element(clumpIndex);
  const bladeIndex = bladeSlot.mul(config.CLUMP_COUNT).add(clumpIndex);
  const bladeState = compute.bladeStateBuffer.element(bladeIndex);
  const playerDistanceSquared = clumpState.xy.dot(clumpState.xy);
  const density = playerDistanceSquared
    .sub(uniforms.uFullDensityRadiusSquared)
    .div(
      uniforms.uDensityFalloffRadiusSquared.sub(
        uniforms.uFullDensityRadiusSquared,
      ),
    )
    .clamp();
  const keepProbability = mix(1, uniforms.uFarDensity, density);
  const densityKeep = step(hash(bladeIndex.add(9176)), keepProbability);
  const scale = getOriginalScale(bladeState).mul(clumpState.z);
  return densityKeep
    .max(getVisibility(bladeState))
    .greaterThan(0)
    .and(scale.greaterThanEqual(config.MIN_VISIBLE_SCALE));
};

const getGrassBladeWorldPosition = (
  compute: GrassCompute,
  clumpIndex: Node<"uint">,
  bladeSlot: Node<"uint">,
  sourcePosition: Node<"vec3">,
) => {
  const { clumpState, bladeState, bladeOffset } = getBladeState(
    compute,
    clumpIndex,
    bladeSlot,
  );
  const scale = getScale(bladeState);
  const bend = getBend(bladeState);
  const bladeHeight = sourcePosition.y.div(config.BLADE_HEIGHT);
  const bendShape = bladeHeight
    .mul(float(1).sub(bladeHeight))
    .mul(uniforms.uBendControlPoint.mul(2))
    .add(bladeHeight.mul(bladeHeight));
  const bendDrop = bend
    .dot(bend)
    .div(scale.mul(config.BLADE_HEIGHT * 2).max(0.01))
    .mul(uniforms.uBendDropStrength);
  const playerDistanceSquared = bladeOffset.dot(bladeOffset);
  const width = getBladeWidth(bladeState, playerDistanceSquared).max(
    MIN_SHADOW_CARD_WIDTH,
  );
  const horizontalLength = lightingManager.uSunDir.xz.length();
  const lightX = horizontalLength
    .lessThan(0.0001)
    .select(
      vec3(1, 0, 0),
      vec3(
        lightingManager.uSunDir.z,
        0,
        lightingManager.uSunDir.x.negate(),
      ).div(horizontalLength.max(0.0001)),
    );
  const base = vec3(
    bladeOffset.x.add(uniforms.uPlayerPosition.x),
    getYOffset(clumpState),
    bladeOffset.y.add(uniforms.uPlayerPosition.z),
  );
  return base
    .add(lightX.mul(sourcePosition.x.mul(width)))
    .add(vec3(0, sourcePosition.y.mul(scale), 0))
    .add(vec3(bend.x, bendDrop.negate(), bend.y).mul(bendShape));
};

export const createGrassShadowInstances = (
  compute: GrassCompute,
): ShadowDeformedInstances => ({
  count: config.CLUMP_COUNT,
  maxRadiusMeters: 8,
  geometry: createGrassShadowGeometry(),
  isActive: (clumpIndex) => {
    const clumpState = compute.clumpStateBuffer.element(clumpIndex);
    return getTerrainCacheValidity(clumpState)
      .greaterThan(0)
      .and(
        clumpState.z
          .mul(uniforms.uBladeMaxScale)
          .greaterThanEqual(config.MIN_VISIBLE_SCALE),
      );
  },
  centerWorldPosition: (clumpIndex) => {
    const clumpState = compute.clumpStateBuffer.element(clumpIndex);
    return vec3(
      clumpState.x.add(uniforms.uPlayerPosition.x),
      getYOffset(clumpState).add(1),
      clumpState.y.add(uniforms.uPlayerPosition.z),
    );
  },
  worldPosition: (clumpIndex, sourcePosition) => {
    const bladeSlot = uint(attribute<"float">("grassBladeSlot", "float"));
    const worldPosition = getGrassBladeWorldPosition(
      compute,
      clumpIndex,
      bladeSlot,
      sourcePosition,
    );
    return isBladeActive(compute, clumpIndex, bladeSlot).select(
      worldPosition,
      vec3(0, -1000000, 0),
    );
  },
});
