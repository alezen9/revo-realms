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
import { config, uniforms } from "./expedition33FlagConfig";

const {
  BEND_WEIGHT,
  STEP_SECONDS,
  SEGMENTS_X,
  SEGMENTS_Y,
  COUNT,
  POINTS_X,
  TETHER_SLACK,
  MAX_SPEED,
  PARTICLES_PER_INVOCATION,
  WORKGROUP_SIZE,
} = config;
const NEIGHBORS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
  [1, -1, 1],
  [-1, -1, 1],
  [2, 0, BEND_WEIGHT],
  [-2, 0, BEND_WEIGHT],
  [0, 2, BEND_WEIGHT],
  [0, -2, BEND_WEIGHT],
];
const cellWidth = uniforms.uFlagWidth.div(SEGMENTS_X);
const cellHeight = uniforms.uFlagHeight.div(SEGMENTS_Y);
const EPSILON = 1e-5;
const GUST_TRAVEL_ACROSS_WIDTH = 0.3;
const GUST_BAND_HEIGHT = 0.21;
const GUST_BAND_OFFSET = 0.37;

const createParticleBuffer = () => instancedArray(COUNT, "vec4");
export type ParticleBuffer = ReturnType<typeof createParticleBuffer>;

// x -> column, y -> row, z -> widthRatio (0 staff, 1 free edge),
// w -> heightRatio (0 top, 1 bottom)
const getGridCoordinates = Fn<[index: Node<"uint">], Node<"vec4">>(
  ([index]) => {
    const row = floor(float(index).div(POINTS_X));
    const column = float(index).mod(POINTS_X);
    const widthRatio = column.div(SEGMENTS_X);
    const heightRatio = row.div(SEGMENTS_Y);
    return vec4(column, row, widthRatio, heightRatio);
  },
);

export const getParticleIndex = Fn<
  [column: Node<"float">, row: Node<"float">],
  Node<"uint">
>(([column, row]) =>
  row
    .clamp(0, SEGMENTS_Y)
    .mul(POINTS_X)
    .add(column.clamp(0, SEGMENTS_X))
    .toUint(),
);

export const getParticleNormal = Fn<
  [positions: ParticleBuffer, index: Node<"uint">],
  Node<"vec3">
>(([positions, index]) => {
  const coordinates = getGridCoordinates(index);
  const column = coordinates.x;
  const row = coordinates.y;
  const left = positions.element(getParticleIndex(column.sub(1), row)).xyz;
  const right = positions.element(getParticleIndex(column.add(1), row)).xyz;
  const up = positions.element(getParticleIndex(column, row.sub(1))).xyz;
  const down = positions.element(getParticleIndex(column, row.add(1))).xyz;
  const cross = down.sub(up).cross(right.sub(left));
  return cross.div(cross.length().max(EPSILON));
});

export const getParticleAtPlanePosition = Fn<
  [positions: ParticleBuffer, planePosition: Node<"vec3">],
  Node<"vec3">
>(([positions, planePosition]) => {
  const column = planePosition.x.add(0.5).mul(SEGMENTS_X).round();
  const row = float(0.5).sub(planePosition.y).mul(SEGMENTS_Y).round();
  return positions.element(getParticleIndex(column, row)).xyz;
});

const getStaffAnchor = Fn<[heightRatio: Node<"float">], Node<"vec3">>(
  ([heightRatio]) => {
    const distanceAlongStaff = uniforms.uAttachTop.sub(
      heightRatio.mul(uniforms.uFlagHeight),
    );
    return uniforms.uStaffAxis.mul(distanceAlongStaff);
  },
);

const clampToTether = Fn<
  [position: Node<"vec3">, anchor: Node<"vec3">, widthRatio: Node<"float">],
  Node<"vec3">
>(([position, anchor, widthRatio]) => {
  const fromAnchor = position.sub(anchor);
  const anchorDistance = fromAnchor.length().max(EPSILON);
  const reach = widthRatio.mul(uniforms.uFlagWidth.mul(TETHER_SLACK));
  const clampedDistance = anchorDistance.min(reach);
  const reachScale = clampedDistance.div(anchorDistance);
  return anchor.add(fromAnchor.mul(reachScale));
});

const pushOutOfPlayer = Fn<[position: Node<"vec3">], Node<"vec3">>(
  ([position]) => {
    const fromPlayer = position.sub(uniforms.uPlayerLocalPosition);
    const distance = fromPlayer.length().max(EPSILON);
    const safeRadius = uniforms.uPlayerRadius.add(uniforms.uCollisionPadding);
    const safeDistance = distance.max(safeRadius);
    const pushScale = safeDistance.div(distance);
    return uniforms.uPlayerLocalPosition.add(fromPlayer.mul(pushScale));
  },
);

const getWindAcceleration = Fn<
  [
    positions: ParticleBuffer,
    index: Node<"uint">,
    coordinates: Node<"vec4">,
    velocity: Node<"vec3">,
  ],
  Node<"vec3">
>(([positions, index, coordinates, velocity]) => {
  const widthRatio = coordinates.z;
  const heightRatio = coordinates.w;
  const windDirection = vec3(wind.uDirection.x, 0, wind.uDirection.y);

  const gustTime = gameTime.mul(uniforms.uGustSpeed);
  const gustU = gustTime.sub(widthRatio.mul(GUST_TRAVEL_ACROSS_WIDTH));
  const gustV = heightRatio.mul(GUST_BAND_HEIGHT).add(GUST_BAND_OFFSET);
  const gustUv = vec2(gustU, gustV);
  const gustNoise = texture(assets.resources.noiseAtlas, gustUv).r;
  const calmGust = float(1).sub(uniforms.uGustStrength);
  const strongGust = float(1).add(uniforms.uGustStrength);
  const gustFactor = mix(calmGust, strongGust, gustNoise);
  const baseWind = uniforms.uWindStrength.add(wind.uIntensityDirectional);
  const windSpeed = baseWind.mul(gustFactor).mul(uniforms.uWindSpeed).max(0);

  const relativeWind = windDirection.mul(windSpeed).sub(velocity);
  const relativeSpeed = relativeWind.length().max(EPSILON);
  const normal = getParticleNormal(positions, index);
  const facing = normal.dot(relativeWind).div(relativeSpeed);

  const dragStrength = facing.abs().mul(relativeSpeed).mul(uniforms.uDrag);
  const drag = relativeWind.mul(dragStrength);
  const windAlongNormal = relativeWind.mul(facing.div(relativeSpeed));
  const acrossWind = normal.sub(windAlongNormal);
  const relativeSpeedSquared = relativeSpeed.mul(relativeSpeed);
  const liftStrength = facing.mul(relativeSpeedSquared).mul(uniforms.uLift);
  const lift = acrossWind.mul(liftStrength);
  return drag.add(lift);
});

// xyz -> weighted pull toward the rest length, w -> applied weight
const pullTowardRest = Fn<
  [
    predictedPositions: ParticleBuffer,
    predicted: Node<"vec3">,
    coordinates: Node<"vec4">,
    offsetX: Node<"float">,
    offsetY: Node<"float">,
    restLength: Node<"float">,
    weight: Node<"float">,
  ],
  Node<"vec4">
>(
  ([
    predictedPositions,
    predicted,
    coordinates,
    offsetX,
    offsetY,
    restLength,
    weight,
  ]) => {
    const neighborColumn = coordinates.x.add(offsetX);
    const neighborRow = coordinates.y.add(offsetY);
    const isInsideLeftEdge = step(-0.5, neighborColumn);
    const isInsideRightEdge = step(neighborColumn, SEGMENTS_X + 0.5);
    const isInsideTopEdge = step(-0.5, neighborRow);
    const isInsideBottomEdge = step(neighborRow, SEGMENTS_Y + 0.5);
    const isInsideGrid = isInsideLeftEdge
      .mul(isInsideRightEdge)
      .mul(isInsideTopEdge)
      .mul(isInsideBottomEdge);
    const appliedWeight = isInsideGrid.mul(weight);

    const isNeighborPinned = step(neighborColumn, 0.5);
    const correctionShare = isNeighborPinned.mul(0.5).add(0.5);

    const neighborIndex = getParticleIndex(neighborColumn, neighborRow);
    const neighbor = predictedPositions.element(neighborIndex).xyz;
    const toNeighbor = predicted.sub(neighbor);
    const distance = toNeighbor.length().max(EPSILON);
    const stretchRatio = restLength.sub(distance).div(distance);
    const pull = toNeighbor.mul(stretchRatio.mul(correctionShare));
    return vec4(pull.mul(appliedWeight), appliedWeight);
  },
);

const integrateParticle = Fn<
  [
    positions: ParticleBuffer,
    previousPositions: ParticleBuffer,
    predictedPositions: ParticleBuffer,
    index: Node<"uint">,
  ],
  void
>(([positions, previousPositions, predictedPositions, index]) => {
  const coordinates = getGridCoordinates(index);
  const position = positions.element(index).xyz.toVar();
  const previous = previousPositions.element(index).xyz;

  const damping = exp(uniforms.uDamping.mul(-STEP_SECONDS));
  const displacement = position.sub(previous).mul(damping).toVar();
  const displacementLength = displacement.length().max(EPSILON);
  const maxDisplacement = displacementLength.min(MAX_SPEED * STEP_SECONDS);
  displacement.mulAssign(maxDisplacement.div(displacementLength));

  const gravity = vec3(0, uniforms.uGravity.negate(), 0);
  const windAcceleration = getWindAcceleration(
    positions,
    index,
    coordinates,
    displacement.div(STEP_SECONDS),
  );
  const acceleration = gravity.add(windAcceleration);
  const predicted = position
    .add(displacement)
    .add(acceleration.mul(STEP_SECONDS * STEP_SECONDS));

  const isPinned = step(coordinates.x, 0.5);
  const anchor = getStaffAnchor(coordinates.w);
  previousPositions
    .element(index)
    .assign(vec4(mix(position, anchor, isPinned), 0));
  predictedPositions
    .element(index)
    .assign(vec4(mix(predicted, anchor, isPinned), 0));
}, "void");

const solveParticle = Fn<
  [
    predictedPositions: ParticleBuffer,
    positions: ParticleBuffer,
    index: Node<"uint">,
  ],
  void
>(([predictedPositions, positions, index]) => {
  const coordinates = getGridCoordinates(index);
  const predicted = predictedPositions.element(index).xyz;

  const total = vec4(0).toVar();
  for (const [offsetX, offsetY, weight] of NEIGHBORS) {
    const restLength = vec2(
      cellWidth.mul(offsetX),
      cellHeight.mul(offsetY),
    ).length();
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
  }
  const corrected = predicted.add(total.xyz.div(total.w.max(1)));

  const anchor = getStaffAnchor(coordinates.w);
  const tethered = clampToTether(corrected, anchor, coordinates.z);
  const collided = pushOutOfPlayer(tethered);

  const isPinned = step(coordinates.x, 0.5);
  positions.element(index).assign(vec4(mix(collided, anchor, isPinned), 0));
}, "void");

const OWNED_SLOTS = {
  start: 0,
  end: PARTICLES_PER_INVOCATION,
  type: "uint",
} as const;

const getOwnedParticle = Fn<[slot: Node<"uint">], Node<"uint">>(([slot]) =>
  invocationLocalIndex.add(slot.mul(WORKGROUP_SIZE)),
);

const initParticles = Fn<
  [positions: ParticleBuffer, previousPositions: ParticleBuffer],
  void
>(([positions, previousPositions]) => {
  const coordinates = getGridCoordinates(instanceIndex);
  const windDirection = vec3(wind.uDirection.x, 0, wind.uDirection.y);
  const distanceFromStaff = coordinates.z.mul(uniforms.uFlagWidth);
  const restPosition = getStaffAnchor(coordinates.w).add(
    windDirection.mul(distanceFromStaff),
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
      If(index.lessThan(COUNT), () => {
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
      If(index.lessThan(COUNT), () => {
        solveParticle(predictedPositions, positions, index);
      });
    });
    storageBarrier();
  });
});

export class Expedition33FlagCompute {
  readonly positions = createParticleBuffer();
  readonly previousPositions = createParticleBuffer();
  private predictedPositions = createParticleBuffer();
  readonly computeInit = initParticles(
    this.positions,
    this.previousPositions,
  ).compute(COUNT, [WORKGROUP_SIZE]);
  readonly computeUpdate = simulateSteps(
    this.positions,
    this.previousPositions,
    this.predictedPositions,
  ).compute(WORKGROUP_SIZE, [WORKGROUP_SIZE]);
}
