import {
  Fn,
  If,
  Loop,
  exp,
  float,
  floor,
  instanceIndex,
  instancedArray,
  invocationLocalIndex,
  mix,
  sin,
  step,
  storageBarrier,
  texture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { assets, wind } from "../../../systems";
import { gameTime } from "../../../systems/time/gameTime";
import { config, uniforms } from "./config";

const { REST_X, REST_Y, BEND_WEIGHT, STEP_SECONDS } = config;
const REST_DIAGONAL = Math.hypot(REST_X, REST_Y);

// column offset, row offset, rest length, weight
const NEIGHBORS = [
  [1, 0, REST_X, 1],
  [-1, 0, REST_X, 1],
  [0, 1, REST_Y, 1],
  [0, -1, REST_Y, 1],
  [1, 1, REST_DIAGONAL, 1],
  [-1, 1, REST_DIAGONAL, 1],
  [1, -1, REST_DIAGONAL, 1],
  [-1, -1, REST_DIAGONAL, 1],
  [2, 0, REST_X * 2, BEND_WEIGHT],
  [-2, 0, REST_X * 2, BEND_WEIGHT],
  [0, 2, REST_Y * 2, BEND_WEIGHT],
  [0, -2, REST_Y * 2, BEND_WEIGHT],
];

const createParticleBuffer = () => instancedArray(config.COUNT, "vec4");
type ParticleBuffer = ReturnType<typeof createParticleBuffer>;

// x -> column, y -> row, z -> widthRatio (0 staff, 1 free edge),
// w -> heightRatio (0 top, 1 bottom)
const getGridCoordinates = Fn<[index: Node<"uint">], Node<"vec4">>(
  ([index]) => {
    const row = floor(float(index).div(config.POINTS_X));
    const column = float(index).mod(config.POINTS_X);
    const widthRatio = column.div(config.SEGMENTS_X);
    const heightRatio = row.div(config.SEGMENTS_Y);
    return vec4(column, row, widthRatio, heightRatio);
  },
);

const getStaffAnchor = Fn<[heightRatio: Node<"float">], Node<"vec3">>(
  ([heightRatio]) => {
    const distanceAlongStaff = float(config.ATTACH_TOP).sub(
      heightRatio.mul(config.FLAG_HEIGHT),
    );
    return uniforms.uStaffAxis.mul(distanceAlongStaff);
  },
);

const clampToTether = Fn<
  [position: Node<"vec3">, anchor: Node<"vec3">, widthRatio: Node<"float">],
  Node<"vec3">
>(([position, anchor, widthRatio]) => {
  const fromAnchor = position.sub(anchor);
  const anchorDistance = fromAnchor.length().max(1e-5);
  const reach = widthRatio.mul(config.FLAG_WIDTH * config.TETHER_SLACK);
  const clampedDistance = anchorDistance.min(reach);
  return anchor.add(fromAnchor.mul(clampedDistance.div(anchorDistance)));
});

const pushOutOfPlayer = Fn<[position: Node<"vec3">], Node<"vec3">>(
  ([position]) => {
    const fromPlayer = position.sub(uniforms.uPlayerLocalPosition);
    const distance = fromPlayer.length().max(1e-5);
    const safeRadius = uniforms.uPlayerRadius.add(uniforms.uCollisionPadding);
    const safeDistance = distance.max(safeRadius);
    return uniforms.uPlayerLocalPosition.add(
      fromPlayer.mul(safeDistance.div(distance)),
    );
  },
);

const getWindAcceleration = Fn<[coordinates: Node<"vec4">], Node<"vec3">>(
  ([coordinates]) => {
    const widthRatio = coordinates.z;
    const heightRatio = coordinates.w;
    const windDirection = vec3(wind.uDirection.x, 0, wind.uDirection.y);
    const windSideways = vec3(wind.uDirection.y.negate(), 0, wind.uDirection.x);

    const gustUv = vec2(
      gameTime.mul(uniforms.uGustSpeed).sub(widthRatio.mul(0.3)),
      heightRatio.mul(0.21).add(0.37),
    );
    const gustNoise = texture(assets.resources.noiseAtlas, gustUv).r;
    const calmGust = float(1).sub(uniforms.uGustStrength);
    const strongGust = float(1).add(uniforms.uGustStrength);
    const gustFactor = mix(calmGust, strongGust, gustNoise);
    const baseWind = uniforms.uWindStrength.add(wind.uIntensityDirectional);
    const windPower = baseWind.mul(gustFactor).max(0);

    const flutterPhase = gameTime
      .mul(3.5)
      .add(widthRatio.mul(9))
      .add(heightRatio.mul(3.4));
    const wavePhase = gameTime
      .mul(9)
      .sub(widthRatio.mul(7))
      .add(heightRatio.mul(1.5));
    const eventWave = sin(wavePhase).mul(wind.uIntensityDirectional.mul(1.5));
    const sidewaysFlutter = sin(flutterPhase).add(eventWave);
    const verticalFlutter = sin(flutterPhase.mul(0.71).add(1.7)).mul(0.6);
    const flutterStrength = uniforms.uFlutter.mul(windPower).mul(widthRatio);
    const flutter = windSideways
      .mul(sidewaysFlutter)
      .add(vec3(0, verticalFlutter, 0))
      .mul(flutterStrength);

    const push = windDirection.mul(
      windPower.mul(windPower).mul(uniforms.uWindForce),
    );
    return push.add(flutter);
  },
);

// xyz -> weighted pull toward the rest length, w -> applied weight
const pullTowardRest = Fn<
  [
    predicted: ParticleBuffer,
    position: Node<"vec3">,
    coordinates: Node<"vec4">,
    offsetX: Node<"float">,
    offsetY: Node<"float">,
    restLength: Node<"float">,
    weight: Node<"float">,
  ],
  Node<"vec4">
>(
  ([
    predicted,
    position,
    coordinates,
    offsetX,
    offsetY,
    restLength,
    weight,
  ]) => {
    const neighborColumn = coordinates.x.add(offsetX);
    const neighborRow = coordinates.y.add(offsetY);
    const isInsideLeftEdge = step(-0.5, neighborColumn);
    const isInsideRightEdge = step(neighborColumn, config.SEGMENTS_X + 0.5);
    const isInsideTopEdge = step(-0.5, neighborRow);
    const isInsideBottomEdge = step(neighborRow, config.SEGMENTS_Y + 0.5);
    const isInsideGrid = isInsideLeftEdge
      .mul(isInsideRightEdge)
      .mul(isInsideTopEdge)
      .mul(isInsideBottomEdge);
    const appliedWeight = isInsideGrid.mul(weight);

    // a pinned neighbor cannot move, so this particle takes the whole correction
    const isNeighborPinned = step(neighborColumn, 0.5);
    const correctionShare = isNeighborPinned.mul(0.5).add(0.5);

    const neighborIndex = neighborRow
      .clamp(0, config.SEGMENTS_Y)
      .mul(config.POINTS_X)
      .add(neighborColumn.clamp(0, config.SEGMENTS_X));
    const neighborPosition = predicted.element(neighborIndex.toUint()).xyz;
    const toNeighbor = position.sub(neighborPosition);
    const distance = toNeighbor.length().max(1e-5);
    const stretchRatio = restLength.sub(distance).div(distance);
    const pull = toNeighbor.mul(stretchRatio.mul(correctionShare));
    return vec4(pull.mul(appliedWeight), appliedWeight);
  },
);

const integrateParticle = (
  positions: ParticleBuffer,
  previousPositions: ParticleBuffer,
  predictedPositions: ParticleBuffer,
  index: Node<"uint">,
) => {
  const coordinates = getGridCoordinates(index);
  const position = positions.element(index).xyz.toVar();
  const previous = previousPositions.element(index).xyz;

  const damping = exp(uniforms.uDamping.mul(-STEP_SECONDS));
  const velocity = position.sub(previous).mul(damping).toVar();
  const displacement = velocity.length().max(1e-6);
  const cappedDisplacement = displacement.min(config.MAX_SPEED * STEP_SECONDS);
  velocity.mulAssign(cappedDisplacement.div(displacement));

  const gravity = vec3(0, uniforms.uGravity.negate(), 0);
  const acceleration = gravity.add(getWindAcceleration(coordinates));
  const predicted = position
    .add(velocity)
    .add(acceleration.mul(STEP_SECONDS * STEP_SECONDS));

  const isPinned = step(coordinates.x, 0.5);
  const anchor = getStaffAnchor(coordinates.w);
  previousPositions
    .element(index)
    .assign(vec4(mix(position, anchor, isPinned), 0));
  predictedPositions
    .element(index)
    .assign(vec4(mix(predicted, anchor, isPinned), 0));
};

const solveParticle = (
  predictedPositions: ParticleBuffer,
  positions: ParticleBuffer,
  index: Node<"uint">,
) => {
  const coordinates = getGridCoordinates(index);
  const predicted = predictedPositions.element(index).xyz;

  const total = vec4(0).toVar();
  for (const [offsetX, offsetY, restLength, weight] of NEIGHBORS)
    total.addAssign(
      pullTowardRest(
        predictedPositions,
        predicted,
        coordinates,
        offsetX,
        offsetY,
        restLength,
        weight,
      ),
    );
  const corrected = predicted.add(total.xyz.div(total.w.max(1)));

  const anchor = getStaffAnchor(coordinates.w);
  const tethered = clampToTether(corrected, anchor, coordinates.z);
  const collided = pushOutOfPlayer(tethered);

  const isPinned = step(coordinates.x, 0.5);
  positions.element(index).assign(vec4(mix(collided, anchor, isPinned), 0));
};

const OWNED_SLOTS = {
  start: 0,
  end: config.PARTICLES_PER_INVOCATION,
  type: "uint",
} as const;

const getOwnedParticle = (slot: Node<"uint">) =>
  invocationLocalIndex.add(slot.mul(config.WORKGROUP_SIZE));

const initParticles = Fn<
  [positions: ParticleBuffer, previousPositions: ParticleBuffer],
  void
>(([positions, previousPositions]) => {
  const coordinates = getGridCoordinates(instanceIndex);
  const windDirection = vec3(wind.uDirection.x, 0, wind.uDirection.y);
  const restPosition = getStaffAnchor(coordinates.w).add(
    windDirection.mul(coordinates.z.mul(config.FLAG_WIDTH)),
  );
  positions.element(instanceIndex).assign(vec4(restPosition, 0));
  previousPositions.element(instanceIndex).assign(vec4(restPosition, 0));
});

const simulateSteps = Fn<
  [
    positions: ParticleBuffer,
    previousPositions: ParticleBuffer,
    predictedPositions: ParticleBuffer,
  ],
  void
>(([positions, previousPositions, predictedPositions]) => {
  Loop({ start: 0, end: uniforms.uStepCount, type: "uint" }, () => {
    Loop(OWNED_SLOTS, ({ i: slot }) => {
      const index = getOwnedParticle(slot);
      If(index.lessThan(config.COUNT), () => {
        integrateParticle(
          positions,
          previousPositions,
          predictedPositions,
          index,
        );
      });
    });
    storageBarrier();

    Loop(OWNED_SLOTS, ({ i: slot }) => {
      const index = getOwnedParticle(slot);
      If(index.lessThan(config.COUNT), () => {
        solveParticle(predictedPositions, positions, index);
      });
    });
    storageBarrier();
  });
});

export class FlagCompute {
  readonly positions = createParticleBuffer();
  private previousPositions = createParticleBuffer();
  private predictedPositions = createParticleBuffer();
  readonly computeInit = initParticles(
    this.positions,
    this.previousPositions,
  ).compute(config.COUNT, [64]);
  readonly computeUpdate = simulateSteps(
    this.positions,
    this.previousPositions,
    this.predictedPositions,
  ).compute(config.WORKGROUP_SIZE, [config.WORKGROUP_SIZE]);
}
