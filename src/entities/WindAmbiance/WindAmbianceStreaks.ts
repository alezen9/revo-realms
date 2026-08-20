import { AdditiveBlending, Color, DoubleSide } from "three";
import {
  cameraPosition,
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
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  InstancedMesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Vector3,
} from "three/webgpu";
import type { Node } from "three/webgpu";
import { type State } from "../../Game";
import type { ComputeTask } from "../../systems/RendererManager/ComputeTask";
import {
  assetManager,
  debugManager,
  eventsManager,
  prewarmManager,
  rendererManager,
  sceneManager,
  windManager,
} from "../../systems";
import { gameTime } from "../../utils/GameTime";
import { TSLUtils } from "../../utils/TSLUtils";

const STREAK_COUNT = 12;
const SEGMENT_COUNT = 24;
const SPINE_POINT_COUNT = SEGMENT_COUNT + 1;
const FIELD_HALF_SIZE = 60;
const TRAIL_LENGTH = 24;

const config = {
  TOTAL_SPINE_POINT_COUNT: STREAK_COUNT * SPINE_POINT_COUNT,
  // a streak is retired once its whole ribbon has cleared the far edge
  RECYCLE_DISTANCE: FIELD_HALF_SIZE + TRAIL_LENGTH,
  EDGE_FADE_SIZE: 18,
  FORWARD_BIAS: 25,
  STREAK_SPEED: 18,
  GROUND_CLEARANCE: 0.16,
  HEIGHT_FOLLOW_RATE: 2.5,
  SPAWN_FADE_DISTANCE: 12,
  GOLDEN_RATIO_CONJUGATE: (Math.sqrt(5) - 1) / 2,
  HEIGHT_SEQUENCE_STEP: Math.SQRT2 - 1,
  MAX_UPDATE_DELTA: 0.1,
  STREAK_WORKGROUP_SIZE: 16,
};

const uniforms = {
  uPlayerPosition: uniform(new Vector3()),
  uDelta: uniform(0),
  uReset: uniform(1),
  uColor: uniform(new Color().setRGB(0.42, 0.47, 0.43)),
  uSpeed: uniform(1.5),
  uHeight: uniform(10),
  uWidth: uniform(0.2),
  uCurveAmplitude: uniform(3.2),
  uCurveWavelength: uniform(48),
};

const getWindSide = Fn(() =>
  vec3(windManager.uDirection.y.negate(), 0, windManager.uDirection.x),
);

const getFieldCenter = Fn(() =>
  uniforms.uPlayerPosition.xz.add(
    windManager.uDirection.mul(config.FORWARD_BIAS),
  ),
);

// the curve is a pure function of arc length, so evaluating it further back
// gives exactly where the head was — that is what makes the body follow it
const getCurveXZ = Fn<
  [origin: Node<"vec2">, arc: Node<"float">, seed: Node<"float">],
  Node<"vec2">
>(([origin, arc, seed]) => {
  const reference = origin.add(windManager.uDirection.mul(arc));
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
    const alongSequence = gustOffset.add(streakIndex.div(STREAK_COUNT)).fract();
    // a full reset spreads the flight evenly, a recycle re-enters at the back
    const spreadAlong = mix(
      -config.RECYCLE_DISTANCE,
      FIELD_HALF_SIZE,
      alongSequence,
    );
    const along = mix(
      float(-config.RECYCLE_DISTANCE),
      spreadAlong,
      uniforms.uReset,
    );
    const lateral = mix(FIELD_HALF_SIZE * -0.85, FIELD_HALF_SIZE * 0.85, lane);
    return getFieldCenter()
      .add(windManager.uDirection.mul(along))
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
      FIELD_HALF_SIZE - config.EDGE_FADE_SIZE,
      FIELD_HALF_SIZE,
      fieldDistance,
    ),
  );
  const spawnFade = smoothstep(
    0,
    config.SPAWN_FADE_DISTANCE,
    lifecycleDistance,
  );
  return windManager.uIntensityDirectional.mul(fieldFade).mul(spawnFade);
});

class WindStreaksSsbo {
  // xy -> curve origin in world XZ, z -> travelled arc, w -> smoothed height
  readonly streaks = instancedArray(STREAK_COUNT, "vec4");
  readonly spinePoints = instancedArray(config.TOTAL_SPINE_POINT_COUNT, "vec4");

  constructor() {
    this.streaks.value.name = "windStreaks.streaks";
    this.spinePoints.value.name = "windStreaks.spinePoints";
  }

  readonly computeStreaks = Fn(() => {
    const streakIndex = float(instanceIndex);
    const seed = hash(streakIndex);
    const variation = streakIndex.mul(config.HEIGHT_SEQUENCE_STEP).fract();
    const streak = this.streaks.element(instanceIndex);
    const origin = streak.xy.toVar();

    const speed = float(config.STREAK_SPEED)
      .mul(uniforms.uSpeed)
      .mul(mix(0.88, 1.12, seed));
    const arc = streak.z.add(
      speed.mul(windManager.uIntensityDirectional).mul(uniforms.uDelta),
    );

    const headXZ = getCurveXZ(origin, arc, seed);
    const alongDistance = headXZ
      .sub(getFieldCenter())
      .dot(windManager.uDirection);
    const isRecycling = step(config.RECYCLE_DISTANCE, alongDistance);
    const shouldReset = uniforms.uReset.max(isRecycling).toVar();
    const nextOrigin = mix(origin, getSpawnOrigin(streakIndex), shouldReset);
    const nextArc = mix(arc, float(0), shouldReset);
    const nextHeadXZ = getCurveXZ(nextOrigin, nextArc, seed);
    const headMapUv = TSLUtils.computeMapUvByPosition(nextHeadXZ);
    const headHeightUv = vec2(headMapUv.x, float(1).sub(headMapUv.y));
    const targetHeight = texture(assetManager.resources.heightmap, headHeightUv)
      .r.add(uniforms.uHeight.mul(mix(0.05, 0.9, variation.mul(variation))))
      .add(config.GROUND_CLEARANCE);
    const heightFollow = float(1).sub(
      exp(uniforms.uDelta.mul(config.HEIGHT_FOLLOW_RATE).negate()),
    );
    const movedHeight = mix(streak.w, targetHeight, heightFollow);
    const nextHeight = mix(movedHeight, targetHeight, shouldReset);

    streak.assign(vec4(nextOrigin.x, nextOrigin.y, nextArc, nextHeight));

    const baseIndex = streakIndex.mul(SPINE_POINT_COUNT);
    Loop(SPINE_POINT_COUNT, ({ i }) => {
      const trailProgress = float(i).div(SEGMENT_COUNT);
      const pointArc = nextArc.sub(trailProgress.mul(TRAIL_LENGTH));
      const positionXZ = getCurveXZ(nextOrigin, pointArc, seed);
      const pointMapUv = TSLUtils.computeMapUvByPosition(positionXZ);
      const pointHeightUv = vec2(pointMapUv.x, float(1).sub(pointMapUv.y));
      const terrainHeight = texture(
        assetManager.resources.heightmap,
        pointHeightUv,
      ).r;
      const height = nextHeight.max(terrainHeight.add(config.GROUND_CLEARANCE));
      const position = vec3(positionXZ.x, height, positionXZ.y);
      const visibility = getVisibility(position, nextArc);

      this.spinePoints
        .element(baseIndex.add(float(i)))
        .assign(vec4(position, visibility));
    });
  })().compute(STREAK_COUNT, [config.STREAK_WORKGROUP_SIZE]);
}

export default class WindAmbianceStreaks {
  private ssbo = new WindStreaksSsbo();
  private computeTask: ComputeTask;
  private mesh: InstancedMesh;
  private elapsedSinceUpdate = 0;
  private isResetPending = false;
  constructor() {
    this.computeTask = rendererManager.createComputeTask({
      label: "WindAmbianceStreaks",
      init: this.ssbo.computeStreaks,
      update: this.ssbo.computeStreaks,
    });
    this.mesh = this.createMesh();
    sceneManager.mainScene.add(this.mesh);
    void this.computeTask.init()?.then(this.clearReset, this.clearReset);
    this.registerPrewarmTask();
    eventsManager.on("game-wind-start", this.onWindStart);
    eventsManager.on("engine-render-update", this.onEngineUpdate);
    this.debug();
  }

  private createMesh() {
    const mesh = new InstancedMesh(
      new PlaneGeometry(1, 1, 1, SEGMENT_COUNT),
      new WindStreakMaterial(this.ssbo),
      STREAK_COUNT,
    );
    mesh.visible = false;
    mesh.frustumCulled = false;
    return mesh;
  }

  private registerPrewarmTask() {
    prewarmManager.registerTask({
      prepare: async () => {
        this.mesh.visible = true;
        await this.computeTask.init();
        await this.computeTask.update();
      },
      restore: () => {
        this.mesh.visible = false;
      },
    });
  }

  private onWindStart = () => {
    this.isResetPending = true;
  };

  private onEngineUpdate = ({ player, delta }: State) => {
    uniforms.uPlayerPosition.value.copy(player.position);

    const isWindActive = windManager.uIntensityDirectional.value > 0;
    this.mesh.visible = isWindActive;
    if (!isWindActive && !this.isResetPending) {
      this.elapsedSinceUpdate = 0;
      return;
    }

    this.elapsedSinceUpdate = Math.min(
      this.elapsedSinceUpdate + delta,
      config.MAX_UPDATE_DELTA,
    );
    this.updateSsbo();
  };

  private updateSsbo() {
    if (!this.computeTask.canUpdate) return;

    uniforms.uDelta.value = this.elapsedSinceUpdate;
    uniforms.uReset.value = this.isResetPending ? 1 : 0;

    const didUpdate = this.computeTask.update();
    if (!didUpdate) return;

    this.elapsedSinceUpdate = 0;
    this.isResetPending = false;
    this.clearReset();
  }

  private clearReset = () => {
    uniforms.uReset.value = 0;
  };

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🌬️ Wind streaks",
      expanded: false,
    });

    folder.addBinding(uniforms.uColor, "value", {
      label: "Color",
      view: "color",
      color: { type: "float" },
    });
    const numberBindings = [
      [uniforms.uSpeed, "Speed", 0, 3, 0.01],
      [uniforms.uHeight, "Height", 0.5, 12, 0.1],
      [uniforms.uWidth, "Width", 0.05, 2, 0.01],
      [uniforms.uCurveAmplitude, "Curve amplitude", 0, 10, 0.1],
      [uniforms.uCurveWavelength, "Curve wavelength", 8, 120, 1],
    ] as const;
    for (const [target, label, min, max, stepSize] of numberBindings) {
      folder.addBinding(target, "value", { label, min, max, step: stepSize });
    }
  }
}

class WindStreakMaterial extends MeshBasicNodeMaterial {
  constructor(ssbo: WindStreaksSsbo) {
    super();

    this.transparent = true;
    this.blending = AdditiveBlending;
    this.depthWrite = false;
    this.forceSinglePass = true;
    this.side = DoubleSide;

    const streakIndex = float(instanceIndex);
    const baseIndex = streakIndex.mul(SPINE_POINT_COUNT);
    const trailProgress = uv().y;
    const row = trailProgress.mul(SEGMENT_COUNT).round();
    const point = ssbo.spinePoints.element(baseIndex.add(row));
    const towardHead = ssbo.spinePoints.element(
      baseIndex.add(row.sub(1).max(0)),
    ).xyz;
    const towardTail = ssbo.spinePoints.element(
      baseIndex.add(row.add(1).min(SEGMENT_COUNT)),
    ).xyz;

    const endpointDirection = vec3(
      windManager.uDirection.x,
      0,
      windManager.uDirection.y,
    )
      .negate()
      .mul(0.001);
    const incoming = point.xyz
      .sub(towardHead)
      .add(endpointDirection)
      .normalize();
    const outgoing = towardTail
      .sub(point.xyz)
      .add(endpointDirection)
      .normalize();
    const tangent = incoming.add(outgoing).normalize();
    const toCamera = cameraPosition.sub(point.xyz);
    const viewDirection = toCamera.div(toCamera.length().max(1e-5));
    const cameraSide = tangent.cross(viewDirection);
    const cameraSideLength = cameraSide.length();
    const cameraSideAxis = cameraSide.div(cameraSideLength.max(1e-5));
    const worldSide = tangent.cross(vec3(0, 1, 0)).normalize();
    const alignedWorldSide = mix(
      worldSide.negate(),
      worldSide,
      step(0, cameraSide.dot(worldSide)),
    );
    const sideBlend = smoothstep(0.05, 0.2, cameraSideLength);
    const sideAxis = mix(
      alignedWorldSide,
      cameraSideAxis,
      sideBlend,
    ).normalize();
    const miterScale = float(1)
      .div(tangent.dot(outgoing).abs().max(1e-3))
      .min(1.5);
    const sideSign = uv().x.mul(2).sub(1);
    const width = uniforms.uWidth
      .mul(smoothstep(0, 0.2, trailProgress))
      .mul(float(1).sub(trailProgress).pow(1.5))
      .mul(miterScale);

    this.positionNode = point.xyz.add(sideAxis.mul(sideSign).mul(width));
    this.colorNode = uniforms.uColor;

    const edgeFade = float(1).sub(smoothstep(0.08, 0.92, sideSign.abs()));
    const headFade = mix(
      0.4,
      1,
      float(1).sub(smoothstep(0.1, 1, trailProgress)),
    );
    this.opacityNode = point.w.mul(0.09).mul(edgeFade).mul(headFade);
  }
}
