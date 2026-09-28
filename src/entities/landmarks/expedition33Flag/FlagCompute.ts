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
export type ParticleBuffer = ReturnType<typeof createParticleBuffer>;
// 0 -> minimum, 1 -> maximum, xyz in flag space
const createBoundsBuffer = () => instancedArray(2, "vec4");
type BoundsBuffer = ReturnType<typeof createBoundsBuffer>;

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

const getParticleIndex = (column: Node<"float">, row: Node<"float">) =>
  row
    .clamp(0, config.SEGMENTS_Y)
    .mul(config.POINTS_X)
    .add(column.clamp(0, config.SEGMENTS_X))
    .toUint();

// points out of the plane geometry's front face, so faceDirection can flip it for the back
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
  return down.sub(up).cross(right.sub(left)).normalize();
});

// shadow rasterization reads the rest plane, so each plane vertex maps back to its particle
export const getParticleAtPlanePoint = Fn<
  [positions: ParticleBuffer, planePoint: Node<"vec3">],
  Node<"vec3">
>(([positions, planePoint]) => {
  const column = planePoint.x.add(0.5).mul(config.SEGMENTS_X).round();
  const row = float(0.5).sub(planePoint.y).mul(config.SEGMENTS_Y).round();
  return positions.element(getParticleIndex(column, row)).xyz;
});

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

// air on a small plate: drag along the relative wind, lift across it, both
// scaled by how much the cloth faces the wind (NvCloth's applyWind model)
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

  const gustUv = vec2(
    gameTime.mul(uniforms.uGustSpeed).sub(widthRatio.mul(0.3)),
    heightRatio.mul(0.21).add(0.37),
  );
  const gustNoise = texture(assets.resources.noiseAtlas, gustUv).r;
  const calmGust = float(1).sub(uniforms.uGustStrength);
  const strongGust = float(1).add(uniforms.uGustStrength);
  const gustFactor = mix(calmGust, strongGust, gustNoise);
  const baseWind = uniforms.uWindStrength.add(wind.uIntensityDirectional);
  const windSpeed = baseWind.mul(gustFactor).mul(uniforms.uWindSpeed).max(0);

  const relativeWind = windDirection.mul(windSpeed).sub(velocity);
  const relativeSpeed = relativeWind.length().max(1e-4);
  const normal = getParticleNormal(positions, index);
  const facing = normal.dot(relativeWind).div(relativeSpeed);

  const drag = relativeWind.mul(
    facing.abs().mul(relativeSpeed).mul(uniforms.uDrag),
  );
  const acrossWind = normal.sub(relativeWind.mul(facing.div(relativeSpeed)));
  const lift = acrossWind.mul(
    facing.mul(relativeSpeed.mul(relativeSpeed)).mul(uniforms.uLift),
  );
  return drag.add(lift);
});

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

    const neighborIndex = getParticleIndex(neighborColumn, neighborRow);
    const neighborPosition = predicted.element(neighborIndex).xyz;
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
  const windAcceleration = getWindAcceleration(
    positions,
    index,
    coordinates,
    velocity.div(STEP_SECONDS),
  );
  const acceleration = gravity.add(windAcceleration);
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

const writeBounds = (positions: ParticleBuffer, bounds: BoundsBuffer) => {
  If(invocationLocalIndex.equal(0), () => {
    const minimum = vec3(1e8).toVar();
    const maximum = vec3(-1e8).toVar();
    Loop({ start: 0, end: config.COUNT, type: "uint" }, ({ i: index }) => {
      const position = positions.element(index).xyz;
      minimum.assign(minimum.min(position));
      maximum.assign(maximum.max(position));
    });
    bounds.element(0).assign(vec4(minimum, 0));
    bounds.element(1).assign(vec4(maximum, 0));
  });
};

const simulateSteps = Fn<
  [
    positions: ParticleBuffer,
    previousPositions: ParticleBuffer,
    predictedPositions: ParticleBuffer,
    bounds: BoundsBuffer,
  ],
  void
>(([positions, previousPositions, predictedPositions, bounds]) => {
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
  writeBounds(positions, bounds);
});

export class FlagCompute {
  readonly positions = createParticleBuffer();
  private previousPositions = createParticleBuffer();
  private predictedPositions = createParticleBuffer();
  readonly bounds = createBoundsBuffer();
  readonly computeInit = initParticles(
    this.positions,
    this.previousPositions,
  ).compute(config.COUNT, [64]);
  readonly computeUpdate = simulateSteps(
    this.positions,
    this.previousPositions,
    this.predictedPositions,
    this.bounds,
  ).compute(config.WORKGROUP_SIZE, [config.WORKGROUP_SIZE]);
}
