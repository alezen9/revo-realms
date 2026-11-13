import {
  exp,
  float,
  floor,
  Fn,
  hash,
  instancedArray,
  instanceIndex,
  Loop,
  mix,
  PI2,
  sin,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { assets, wind } from "../../systems";
import { gameTime } from "../../systems/time/gameTime";
import { computeMapUvByPosition } from "../../shaders/mapping";
import { config, uniforms } from "./WindStreaksConfig";

const getWindSide = Fn(() =>
  vec3(wind.uDirection.y.negate(), 0, wind.uDirection.x),
);

const getFieldCenter = Fn(() =>
  uniforms.uPlayerPosition.xz.add(wind.uDirection.mul(config.FORWARD_BIAS)),
);

// the curve is a pure function of arc length, so evaluating it further back
// gives exactly where the head was, which is what makes the body follow it
const getCurveXZ = Fn<
  [origin: Node<"vec2">, arc: Node<"float">, seed: Node<"float">],
  Node<"vec2">
>(([origin, arc, seed]) => {
  const reference = origin.add(wind.uDirection.mul(arc));
  const waveNumber = float(PI2).div(uniforms.uCurveWavelength);
  const lateral = sin(arc.mul(waveNumber).add(seed.mul(PI2))).mul(
    uniforms.uCurveAmplitude,
  );
  return reference.add(getWindSide().xz.mul(lateral));
});

const getSpawnOrigin = Fn<[streakIndex: Node<"float">], Node<"vec2">>(
  ([streakIndex]) => {
    const gustOffset = hash(floor(gameTime));
    const lane = gustOffset
      .add(streakIndex.mul(config.GOLDEN_RATIO_CONJUGATE))
      .fract();
    const alongSequence = gustOffset
      .add(streakIndex.div(config.STREAK_COUNT))
      .fract();
    // a full reset spreads the flight evenly, a recycle re-enters at the back
    const spreadAlong = mix(
      -config.RECYCLE_DISTANCE,
      config.FIELD_HALF_SIZE,
      alongSequence,
    );
    const along = mix(
      float(-config.RECYCLE_DISTANCE),
      spreadAlong,
      uniforms.uReset,
    );
    const lateral = mix(
      config.FIELD_HALF_SIZE * -0.85,
      config.FIELD_HALF_SIZE * 0.85,
      lane,
    );
    return getFieldCenter()
      .add(wind.uDirection.mul(along))
      .add(getWindSide().xz.mul(lateral));
  },
);

const getVisibility = Fn<
  [position: Node<"vec3">, lifecycleDistance: Node<"float">],
  Node<"float">
>(([position, lifecycleDistance]) => {
  const relativePosition = position.xz.sub(getFieldCenter()).abs();
  const fieldDistance = relativePosition.x.max(relativePosition.y);
  const fieldFade = float(1).sub(
    smoothstep(
      config.FIELD_HALF_SIZE - config.EDGE_FADE_SIZE,
      config.FIELD_HALF_SIZE,
      fieldDistance,
    ),
  );
  const spawnFade = smoothstep(
    0,
    config.SPAWN_FADE_DISTANCE,
    lifecycleDistance,
  );
  return wind.uIntensityDirectional.mul(fieldFade).mul(spawnFade);
});

const createStreakBuffer = () => instancedArray(config.STREAK_COUNT, "vec4");
const createSpinePointBuffer = () =>
  instancedArray(config.TOTAL_SPINE_POINT_COUNT, "vec4");
type StreakBuffer = ReturnType<typeof createStreakBuffer>;
type SpinePointBuffer = ReturnType<typeof createSpinePointBuffer>;

const updateStreaks = Fn<
  [streaks: StreakBuffer, spinePoints: SpinePointBuffer],
  void
>(([streaks, spinePoints]) => {
  const streakIndex = float(instanceIndex);
  const seed = hash(streakIndex);
  const variation = streakIndex.mul(config.HEIGHT_SEQUENCE_STEP).fract();
  const streak = streaks.element(instanceIndex);
  const origin = streak.xy.toVar();

  const speedVariation = mix(0.88, 1.12, seed);
  const speed = float(config.STREAK_SPEED)
    .mul(uniforms.uSpeed)
    .mul(speedVariation);
  const arcStep = speed.mul(wind.uIntensityDirectional).mul(uniforms.uDelta);
  const arc = streak.z.add(arcStep);

  const headXZ = getCurveXZ(origin, arc, seed);
  const headOffset = headXZ.sub(getFieldCenter());
  const alongDistance = headOffset.dot(wind.uDirection);
  const isRecycling = step(config.RECYCLE_DISTANCE, alongDistance);
  const shouldReset = uniforms.uReset.max(isRecycling).toVar();
  const nextOrigin = mix(origin, getSpawnOrigin(streakIndex), shouldReset);
  const nextArc = mix(arc, float(0), shouldReset);
  const nextHeadXZ = getCurveXZ(nextOrigin, nextArc, seed);
  const headMapUv = computeMapUvByPosition(nextHeadXZ);
  const headHeightUv = vec2(headMapUv.x, float(1).sub(headMapUv.y));
  const headTerrainHeight = texture(assets.resources.heightmap, headHeightUv).r;
  const heightVariation = mix(0.05, 0.9, variation.mul(variation));
  const hoverHeight = uniforms.uHeight.mul(heightVariation);
  const targetHeight = headTerrainHeight
    .add(hoverHeight)
    .add(config.GROUND_CLEARANCE);
  const followDecay = exp(
    uniforms.uDelta.mul(config.HEIGHT_FOLLOW_RATE).negate(),
  );
  const heightFollow = float(1).sub(followDecay);
  const movedHeight = mix(streak.w, targetHeight, heightFollow);
  const nextHeight = mix(movedHeight, targetHeight, shouldReset);

  streak.assign(vec4(nextOrigin.x, nextOrigin.y, nextArc, nextHeight));

  const baseIndex = streakIndex.mul(config.SPINE_POINT_COUNT);
  Loop(config.SPINE_POINT_COUNT, ({ i }) => {
    const trailProgress = float(i).div(config.SEGMENT_COUNT);
    const pointArc = nextArc.sub(trailProgress.mul(config.TRAIL_LENGTH));
    const positionXZ = getCurveXZ(nextOrigin, pointArc, seed);
    const pointMapUv = computeMapUvByPosition(positionXZ);
    const pointHeightUv = vec2(pointMapUv.x, float(1).sub(pointMapUv.y));
    const terrainHeight = texture(assets.resources.heightmap, pointHeightUv).r;
    const clearedTerrainHeight = terrainHeight.add(config.GROUND_CLEARANCE);
    const height = nextHeight.max(clearedTerrainHeight);
    const position = vec3(positionXZ.x, height, positionXZ.y);
    const visibility = getVisibility(position, nextArc);

    spinePoints
      .element(baseIndex.add(float(i)))
      .assign(vec4(position, visibility));
  });
});

export class WindStreaksCompute {
  // xy -> curve origin in world XZ, z -> travelled arc, w -> smoothed height
  readonly streaks = createStreakBuffer();
  readonly spinePoints = createSpinePointBuffer();
  readonly computeStreaks;

  constructor() {
    this.streaks.value.name = "windStreaks.streaks";
    this.spinePoints.value.name = "windStreaks.spinePoints";
    this.computeStreaks = updateStreaks(this.streaks, this.spinePoints).compute(
      config.STREAK_COUNT,
      [config.STREAK_WORKGROUP_SIZE],
    );
  }
}
