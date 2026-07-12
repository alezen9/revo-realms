import {
  Fn,
  Loop,
  float,
  floor,
  instancedArray,
  instanceIndex,
  mix,
  sin,
  step,
  texture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { assetManager, windManager } from "../../../systems";
import { gameTime } from "../../../utils/GameTime";
import { config, uniforms } from "./config";

const REST_X = config.REST_X;
const REST_Y = config.REST_Y;
const REST_DIAGONAL = Math.hypot(REST_X, REST_Y);
const BEND_WEIGHT = 0.35;

const createClothBuffer = () => instancedArray(config.COUNT, "vec4");
type ClothBuffer = ReturnType<typeof createClothBuffer>;

// x -> columnIndex, y -> rowIndex, z -> widthRatio (0 staff, 1 free edge),
// w -> heightRatio (0 top, 1 bottom)
const gridCoordinates = Fn(() => {
  const rowIndex = floor(float(instanceIndex).div(config.POINTS_X));
  const columnIndex = float(instanceIndex).mod(config.POINTS_X);
  const widthRatio = columnIndex.div(config.SEGMENTS_X);
  const heightRatio = rowIndex.div(config.SEGMENTS_Y);
  return vec4(columnIndex, rowIndex, widthRatio, heightRatio);
});

const staffAnchor = Fn<[heightRatio: Node<"float">], Node<"vec3">>(
  ([heightRatio]) => {
    const distanceAlongStaff = float(config.ATTACH_TOP).sub(
      heightRatio.mul(config.FLAG_HEIGHT),
    );
    return uniforms.uStaffAxis.mul(distanceAlongStaff);
  },
);

const clampToStaffReach = Fn<
  [position: Node<"vec3">, anchor: Node<"vec3">, widthRatio: Node<"float">],
  Node<"vec3">
>(([position, anchor, widthRatio]) => {
  const fromAnchor = position.sub(anchor);
  const anchorDistance = fromAnchor.length().max(1e-5);
  const reach = widthRatio.mul(config.FLAG_WIDTH).mul(1.1).add(0.02);
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

// xyz -> weighted pull toward satisfying the constraint, w -> applied weight
const createConstraintPull = (source: ClothBuffer) =>
  Fn<
    [
      position: Node<"vec3">,
      coordinates: Node<"vec4">,
      offsetX: Node<"float">,
      offsetY: Node<"float">,
      restLength: Node<"float">,
      weight: Node<"float">,
    ],
    Node<"vec4">
  >(([position, coordinates, offsetX, offsetY, restLength, weight]) => {
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

    const neighborIndex = neighborRow
      .clamp(0, config.SEGMENTS_Y)
      .mul(config.POINTS_X)
      .add(neighborColumn.clamp(0, config.SEGMENTS_X));
    const neighborPosition = source.element(neighborIndex.toUint()).xyz;
    const toNeighbor = position.sub(neighborPosition);
    const distance = toNeighbor.length().max(1e-5);
    const stretchRatio = restLength.sub(distance).div(distance);
    const pull = toNeighbor.mul(stretchRatio.mul(0.5));
    return vec4(pull.mul(appliedWeight), appliedWeight);
  });

export class FlagSsbo {
  private positionBuffer = createClothBuffer();
  private scratchBuffer = createClothBuffer();
  private previousBuffer = createClothBuffer();
  private pullFromPosition = createConstraintPull(this.positionBuffer);
  private pullFromScratch = createConstraintPull(this.scratchBuffer);

  get positions() {
    return this.positionBuffer;
  }

  computeInit = Fn(() => {
    const coordinates = gridCoordinates();
    const widthRatio = coordinates.z;
    const heightRatio = coordinates.w;

    const windDirection = vec3(
      windManager.uDirection.x,
      0,
      windManager.uDirection.y,
    );
    const restPosition = staffAnchor(heightRatio).add(
      windDirection.mul(widthRatio.mul(config.FLAG_WIDTH)),
    );
    this.positionBuffer.element(instanceIndex).assign(vec4(restPosition, 0));
    this.scratchBuffer.element(instanceIndex).assign(vec4(restPosition, 0));
    this.previousBuffer.element(instanceIndex).assign(vec4(restPosition, 0));
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  computeIntegrate = Fn(() => {
    const coordinates = gridCoordinates();
    const columnIndex = coordinates.x;
    const widthRatio = coordinates.z;
    const heightRatio = coordinates.w;

    const positionData = this.positionBuffer.element(instanceIndex);
    const previousData = this.previousBuffer.element(instanceIndex);
    const deltaTime = uniforms.uDelta;
    const position = positionData.xyz.toVar();

    const dampingFactor = float(1).sub(uniforms.uDamping.mul(deltaTime)).max(0);
    const velocity = position.sub(previousData.xyz).mul(dampingFactor).toVar();
    const speed = velocity.length().max(1e-6);
    const cappedSpeed = speed.min(config.MAX_STEP);
    velocity.mulAssign(cappedSpeed.div(speed));

    const windDirection = vec3(
      windManager.uDirection.x,
      0,
      windManager.uDirection.y,
    );
    const windSideways = vec3(
      windManager.uDirection.y.negate(),
      0,
      windManager.uDirection.x,
    );

    const gustUv = vec2(
      gameTime.mul(uniforms.uGustSpeed).sub(widthRatio.mul(0.3)),
      heightRatio.mul(0.21).add(0.37),
    );
    const gustNoise = texture(assetManager.resources.noiseAtlas, gustUv).r;
    const calmGust = float(1).sub(uniforms.uGustStrength);
    const strongGust = float(1).add(uniforms.uGustStrength);
    const gustFactor = mix(calmGust, strongGust, gustNoise);
    const baseWind = uniforms.uWindStrength.add(
      windManager.uIntensityDirectional,
    );
    const windPower = baseWind.mul(gustFactor).max(0);

    const flutterPhase = gameTime
      .mul(3.5)
      .add(widthRatio.mul(9))
      .add(heightRatio.mul(3.4));
    const wavePhase = gameTime
      .mul(9)
      .sub(widthRatio.mul(7))
      .add(heightRatio.mul(1.5));
    const eventWave = sin(wavePhase).mul(
      windManager.uIntensityDirectional.mul(1.5),
    );
    const sidewaysFlutter = sin(flutterPhase).add(eventWave);
    const verticalFlutter = sin(flutterPhase.mul(0.71).add(1.7)).mul(0.6);
    const flutterStrength = uniforms.uFlutter.mul(windPower).mul(widthRatio);
    const flutter = windSideways
      .mul(sidewaysFlutter)
      .add(vec3(0, verticalFlutter, 0))
      .mul(flutterStrength);

    const windAcceleration = windDirection.mul(
      windPower.mul(windPower).mul(uniforms.uWindForce),
    );
    const gravityAcceleration = vec3(0, uniforms.uGravity.negate(), 0);
    const acceleration = windAcceleration.add(gravityAcceleration).add(flutter);
    const nextPosition = position
      .add(velocity)
      .add(acceleration.mul(deltaTime.mul(deltaTime)));

    const pinned = step(columnIndex, 0.5);
    const anchor = staffAnchor(heightRatio);
    previousData.assign(vec4(mix(position, anchor, pinned), 0));
    positionData.assign(vec4(mix(nextPosition, anchor, pinned), 0));
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  private createConstraintPass = (
    pull: ReturnType<typeof createConstraintPull>,
    target: ClothBuffer,
    source: ClothBuffer,
  ) =>
    Fn(() => {
      const coordinates = gridCoordinates();
      const columnIndex = coordinates.x;
      const widthRatio = coordinates.z;
      const heightRatio = coordinates.w;
      const position = source.element(instanceIndex).xyz.toVar();

      // structural ring: right, left, down, up
      const structural = pull(position, coordinates, 1, 0, REST_X, 1)
        .add(pull(position, coordinates, -1, 0, REST_X, 1))
        .add(pull(position, coordinates, 0, 1, REST_Y, 1))
        .add(pull(position, coordinates, 0, -1, REST_Y, 1));
      // shear ring: down-right, down-left, up-right, up-left
      const shear = pull(position, coordinates, 1, 1, REST_DIAGONAL, 1)
        .add(pull(position, coordinates, -1, 1, REST_DIAGONAL, 1))
        .add(pull(position, coordinates, 1, -1, REST_DIAGONAL, 1))
        .add(pull(position, coordinates, -1, -1, REST_DIAGONAL, 1));
      // weak two-ring bending: resists sharp creases
      const bending = pull(position, coordinates, 2, 0, REST_X * 2, BEND_WEIGHT)
        .add(pull(position, coordinates, -2, 0, REST_X * 2, BEND_WEIGHT))
        .add(pull(position, coordinates, 0, 2, REST_Y * 2, BEND_WEIGHT))
        .add(pull(position, coordinates, 0, -2, REST_Y * 2, BEND_WEIGHT));

      const total = structural.add(shear).add(bending);
      const correction = total.xyz.div(total.w.max(1));
      position.addAssign(correction.mul(uniforms.uStiffness));

      const anchor = staffAnchor(heightRatio);
      position.assign(clampToStaffReach(position, anchor, widthRatio));
      position.assign(pushOutOfPlayer(position));

      const pinned = step(columnIndex, 0.5);
      target
        .element(instanceIndex)
        .assign(vec4(mix(position, anchor, pinned), 0));
    })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  private createSelfCollisionPass = (
    source: ClothBuffer,
    target: ClothBuffer,
  ) =>
    Fn(() => {
      const coordinates = gridCoordinates();
      const columnIndex = coordinates.x;
      const rowIndex = coordinates.y;
      const widthRatio = coordinates.z;
      const heightRatio = coordinates.w;
      const position = source.element(instanceIndex).xyz.toVar();
      const separation = vec3(0).toVar();

      Loop(config.COUNT, ({ i }) => {
        const otherRow = floor(float(i).div(config.POINTS_X));
        const otherColumn = float(i).mod(config.POINTS_X);
        const columnDistance = otherColumn.sub(columnIndex).abs();
        const rowDistance = otherRow.sub(rowIndex).abs();
        const gridDistance = columnDistance.max(rowDistance);
        const isFarInGrid = step(1.5, gridDistance);

        const toOther = position.sub(source.element(i).xyz);
        const distance = toOther.length().max(1e-5);
        const overlap = uniforms.uThickness.sub(distance).max(0);
        const push = toOther.mul(overlap.div(distance).mul(0.5));
        separation.addAssign(push.mul(isFarInGrid));
      });
      const separationLength = separation.length().max(1e-6);
      const cappedLength = separationLength.min(uniforms.uThickness);
      position.addAssign(separation.mul(cappedLength.div(separationLength)));

      const anchor = staffAnchor(heightRatio);
      position.assign(clampToStaffReach(position, anchor, widthRatio));
      position.assign(pushOutOfPlayer(position));

      const pinned = step(columnIndex, 0.5);
      target
        .element(instanceIndex)
        .assign(vec4(mix(position, anchor, pinned), 0));
    })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  computeConstraintPasses = [
    this.createConstraintPass(
      this.pullFromPosition,
      this.scratchBuffer,
      this.positionBuffer,
    ),
    this.createConstraintPass(
      this.pullFromScratch,
      this.positionBuffer,
      this.scratchBuffer,
    ),
    this.createConstraintPass(
      this.pullFromPosition,
      this.scratchBuffer,
      this.positionBuffer,
    ),
    this.createConstraintPass(
      this.pullFromScratch,
      this.positionBuffer,
      this.scratchBuffer,
    ),
    this.createConstraintPass(
      this.pullFromPosition,
      this.scratchBuffer,
      this.positionBuffer,
    ),
    this.createSelfCollisionPass(this.scratchBuffer, this.positionBuffer),
  ];
}
