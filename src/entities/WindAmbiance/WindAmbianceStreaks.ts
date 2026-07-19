import { AdditiveBlending, Color, DoubleSide } from "three";
import {
  cameraPosition,
  cos,
  float,
  floor,
  Fn,
  hash,
  If,
  instancedArray,
  instanceIndex,
  Loop,
  mix,
  PI2,
  sin,
  smoothstep,
  step,
  texture,
  uv,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  InstancedMesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Vector2,
  Vector3,
} from "three/webgpu";
import { type State } from "../../Game";
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
import { VegetationSsboUtils } from "../Vegetation/ssboUtils";

const uniforms = {
  uWindDirection: uniform(new Vector2(0, -1)),
  uPlayerPosition: uniform(new Vector3()),
  uDelta: uniform(0),
  uEffectFade: uniform(0),
  uHead: uniform(0),
  uAdvance: uniform(0),
  uRecordPhase: uniform(0),
  uColor: uniform(new Color().setRGB(0.42, 0.47, 0.43)),
  uSpeed: uniform(1),
  uHeight: uniform(10),
  uWidth: uniform(0.2),
};

const getConfig = () => {
  const STREAK_COUNT = 12;
  const SEGMENTS = 24;
  const POINTS = SEGMENTS + 1;
  const FIELD_SIZE = 120;

  return {
    STREAK_COUNT,
    SEGMENTS,
    POINTS,
    TOTAL_POINTS: STREAK_COUNT * POINTS,
    FIELD_SIZE,
    FIELD_HALF_SIZE: FIELD_SIZE / 2,
    EDGE_FADE_SIZE: 18,
    FORWARD_BIAS: 25,
    GROUND_CLEARANCE: 0.16,
    STREAK_LIFETIME: 6.4,
    STREAK_SPEED: 30,
    RESPAWN_DELAY: 1.6,
    RECORD_INTERVAL: 0.075,
    DISTRIBUTION_STEP: (Math.sqrt(5) - 1) / 2,
    VARIATION_SEED_OFFSET: 2048,
    FLOW_MIP_LEVEL: 2,
    FLOW_NOISE_SCALE: 0.007,
    FLOW_SCROLL_X: 0.012,
    FLOW_SCROLL_Y: 0.008,
    VERTICAL_FLOW_SPEED: 1.2,
    HEIGHT_RELAX: 0.05,
    SWIRL_ANGLE: 0.3,
    DRIFT_ANGLE: 0.5,
    SPEED_PULSE: 0.35,
    GLOW_SPEED: 3,
    GLOW_STRENGTH: 0.25,
    ACTIVE_INTENSITY_THRESHOLD: 0.24,
    FADE_IN_RATE: 0.25,
    FADE_OUT_RATE: 0.35,
    WORKGROUP_SIZE: 16,
  };
};

const config = getConfig();

class WindStreaksSsbo {
  // ring of POINTS slots per streak
  // x -> worldX
  // y -> worldY
  // z -> worldZ
  // w -> unused
  readonly points = instancedArray(config.TOTAL_POINTS, "vec4");
  // age -> [-RESPAWN_DELAY, STREAK_LIFETIME], negative while respawning
  readonly ages = instancedArray(config.STREAK_COUNT, "float");

  constructor() {
    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
  }

  private computeInit = Fn(() => {
    const pointIndex = float(instanceIndex);
    const streakIndex = floor(pointIndex.div(config.POINTS));
    const seed = hash(streakIndex);
    const offsetX = streakIndex
      .mul(config.DISTRIBUTION_STEP)
      .fract()
      .sub(0.5)
      .mul(config.FIELD_SIZE);
    const offsetZ = streakIndex
      .add(seed)
      .div(config.STREAK_COUNT)
      .sub(0.5)
      .mul(config.FIELD_SIZE);
    const fieldCenter = uniforms.uPlayerPosition.xz.add(
      uniforms.uWindDirection.mul(config.FORWARD_BIAS),
    );

    this.points
      .element(instanceIndex)
      .assign(
        vec4(offsetX.add(fieldCenter.x), 0, offsetZ.add(fieldCenter.y), 0),
      );

    const isHeadPoint = pointIndex.mod(config.POINTS).lessThan(0.5);
    If(isHeadPoint, () => {
      const age = seed
        .mul(config.STREAK_LIFETIME + config.RESPAWN_DELAY)
        .sub(config.RESPAWN_DELAY);
      this.ages.element(streakIndex).assign(age);
    });
  })().compute(config.TOTAL_POINTS, [64]);

  readonly computeUpdate = Fn(() => {
    const streakIndex = float(instanceIndex);
    const base = streakIndex.mul(config.POINTS);
    const seed = hash(streakIndex);
    const variation = hash(streakIndex.add(config.VARIATION_SEED_OFFSET));
    const windDirection = uniforms.uWindDirection;
    const headSlot = base.add(uniforms.uHead);
    const previousSlot = base.add(
      uniforms.uHead.sub(1).add(config.POINTS).mod(config.POINTS),
    );

    If(uniforms.uAdvance.greaterThan(0.5), () => {
      this.points.element(headSlot).assign(this.points.element(previousSlot));
    });

    const head = this.points.element(headSlot);
    const ageData = this.ages.element(instanceIndex);
    const age = ageData.add(uniforms.uDelta.mul(uniforms.uSpeed));
    const isAlive = step(0, age);
    const flowScroll = vec2(
      gameTime.mul(config.FLOW_SCROLL_X),
      gameTime.mul(config.FLOW_SCROLL_Y),
    );
    const flowUv = head.xz.mul(config.FLOW_NOISE_SCALE).add(flowScroll);
    const flow = texture(
      assetManager.resources.noiseAtlas,
      flowUv,
      config.FLOW_MIP_LEVEL,
    );
    const speedVariation = mix(0.75, 1.25, seed);
    const gustSpeed = mix(0.86, 1.14, flow.r);
    const pulseFrequency = mix(0.4, 0.9, variation).mul(PI2);
    const speedPulse = float(1).add(
      sin(gameTime.mul(pulseFrequency).add(variation.mul(PI2))).mul(
        config.SPEED_PULSE,
      ),
    );
    const forwardVelocity = float(config.STREAK_SPEED)
      .mul(uniforms.uSpeed)
      .mul(speedVariation)
      .mul(gustSpeed)
      .mul(speedPulse);

    const driftHeading = flow.g.mul(2).sub(1).mul(config.DRIFT_ANGLE);
    const swirlFrequency = mix(0.35, 0.8, seed).mul(PI2);
    const swirlHeading = sin(
      gameTime.mul(swirlFrequency).add(seed.mul(PI2)),
    ).mul(config.SWIRL_ANGLE);
    const heading = driftHeading.add(swirlHeading);
    const headingCos = cos(heading);
    const headingSin = sin(heading);
    const direction = vec2(
      windDirection.x.mul(headingCos).sub(windDirection.y.mul(headingSin)),
      windDirection.x.mul(headingSin).add(windDirection.y.mul(headingCos)),
    );
    const velocity = direction.mul(forwardVelocity);
    const movement = velocity.mul(uniforms.uDelta).mul(isAlive);
    const fieldCenter = uniforms.uPlayerPosition.xz.add(
      windDirection.mul(config.FORWARD_BIAS),
    );
    const relativePosition = head.xz.sub(fieldCenter).add(movement);
    const wrappedXZ = VegetationSsboUtils.wrapPosition(
      relativePosition,
      vec2(0),
      config.FIELD_SIZE,
    ).xz;
    const expired = step(config.STREAK_LIFETIME, age);
    const respawnSalt = floor(gameTime).mul(config.STREAK_COUNT);
    const respawnSeedX = hash(streakIndex.add(respawnSalt));
    const respawnSeedZ = hash(
      streakIndex.add(respawnSalt).add(config.VARIATION_SEED_OFFSET),
    );
    const respawnRel = vec2(respawnSeedX, respawnSeedZ)
      .sub(0.5)
      .mul(config.FIELD_SIZE);
    const totalShift = wrappedXZ
      .sub(relativePosition)
      .add(respawnRel.sub(wrappedXZ).mul(expired));
    const nextXZ = relativePosition.add(fieldCenter);
    const worldPosition = vec3(nextXZ.x, 0, nextXZ.y);
    const terrainHeight = VegetationSsboUtils.computeYOffset(worldPosition);
    const streakLift = uniforms.uHeight.mul(
      mix(0.05, 0.9, variation.mul(variation)),
    );
    const targetHeight = terrainHeight
      .add(streakLift)
      .add(config.GROUND_CLEARANCE);
    const verticalFlow = flow.b
      .mul(2)
      .sub(1)
      .mul(config.VERTICAL_FLOW_SPEED)
      .mul(uniforms.uSpeed);
    const driftedHeight = head.y.add(
      verticalFlow.mul(uniforms.uDelta).mul(isAlive),
    );
    const nextHeight = mix(driftedHeight, targetHeight, config.HEIGHT_RELAX);

    head.assign(vec4(nextXZ.x, nextHeight, nextXZ.y, 0));

    If(totalShift.x.abs().add(totalShift.y.abs()).greaterThan(0.5), () => {
      Loop(config.POINTS, ({ i }) => {
        const slot = this.points.element(base.add(float(i)));
        slot.x = slot.x.add(totalShift.x);
        slot.z = slot.z.add(totalShift.y);
      });
    });

    const respawnDelay = variation.mul(config.RESPAWN_DELAY).negate();
    ageData.assign(mix(age, respawnDelay, expired));
  })().compute(config.STREAK_COUNT, [config.WORKGROUP_SIZE]);
}

export default class WindAmbianceStreaks {
  private ssbo = new WindStreaksSsbo();
  private mesh: InstancedMesh;
  private isComputeInFlight = false;
  private effectFade = 0;
  private pendingDelta = 0;
  private recordTimer = 0;
  private headIndex = 0;

  constructor() {
    this.mesh = this.createMesh();
    sceneManager.scene.add(this.mesh);
    this.registerPrewarmTask();
    eventsManager.on("engine-render-update", this.onEngineUpdate);
    this.debug();
  }

  private createMesh() {
    const mesh = new InstancedMesh(
      new PlaneGeometry(1, 1, 1, config.SEGMENTS),
      new WindStreakMaterial(this.ssbo),
      config.STREAK_COUNT,
    );
    mesh.visible = false;
    mesh.frustumCulled = false;
    return mesh;
  }

  private registerPrewarmTask() {
    prewarmManager.registerTask({
      prepare: async () => {
        this.mesh.visible = true;
        await rendererManager.renderer.computeAsync(this.ssbo.computeUpdate);
      },
      restore: () => {
        this.mesh.visible = false;
      },
    });
  }

  private onEngineUpdate = ({ player, delta }: State) => {
    uniforms.uPlayerPosition.value.copy(player.position);
    this.pendingDelta = Math.min(this.pendingDelta + delta, 0.1);
    uniforms.uRecordPhase.value = Math.min(
      (this.recordTimer + this.pendingDelta) / config.RECORD_INTERVAL,
      1,
    );

    if (this.effectFade === 0)
      uniforms.uWindDirection.value.copy(windManager.uDirection.value);
    const isDirectionCurrent = uniforms.uWindDirection.value.equals(
      windManager.uDirection.value,
    );

    const intensity = windManager.uIntensityDirectional.value;
    const isActive =
      intensity > config.ACTIVE_INTENSITY_THRESHOLD && isDirectionCurrent;
    const fadeRate = isActive ? config.FADE_IN_RATE : -config.FADE_OUT_RATE;
    this.effectFade = Math.max(
      0,
      Math.min(1, this.effectFade + delta * fadeRate),
    );
    uniforms.uEffectFade.value = this.effectFade;

    this.mesh.visible = isActive || this.effectFade > 0.001;
    this.updateSsbo();
  };

  private async updateSsbo() {
    if (this.isComputeInFlight) return;

    this.isComputeInFlight = true;
    this.recordTimer += this.pendingDelta;
    uniforms.uDelta.value = this.pendingDelta;
    this.pendingDelta = 0;

    const shouldAdvance = this.recordTimer >= config.RECORD_INTERVAL;
    if (shouldAdvance) {
      this.recordTimer %= config.RECORD_INTERVAL;
      this.headIndex = (this.headIndex + 1) % config.POINTS;
      uniforms.uHead.value = this.headIndex;
    }
    uniforms.uAdvance.value = shouldAdvance ? 1 : 0;

    try {
      await rendererManager.renderer.computeAsync(this.ssbo.computeUpdate);
    } catch (error) {
      console.error("[WindAmbianceStreaks] computeAsync failed:", error);
    } finally {
      this.isComputeInFlight = false;
    }
  }

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
    folder.addBinding(uniforms.uSpeed, "value", {
      label: "Speed",
      min: 0,
      max: 3,
      step: 0.01,
    });
    folder.addBinding(uniforms.uHeight, "value", {
      label: "Height",
      min: 0.5,
      max: 12,
      step: 0.1,
    });
    folder.addBinding(uniforms.uWidth, "value", {
      label: "Width",
      min: 0.05,
      max: 2,
      step: 0.01,
    });
    folder.addBinding(config, "FADE_IN_RATE", {
      label: "Fade in",
      min: 0.1,
      max: 4,
      step: 0.05,
    });
    folder.addBinding(config, "FADE_OUT_RATE", {
      label: "Fade out",
      min: 0.1,
      max: 4,
      step: 0.05,
    });
  }
}

class WindStreakMaterial extends MeshBasicNodeMaterial {
  constructor(ssbo: WindStreaksSsbo) {
    super();

    this.precision = "lowp";
    this.transparent = true;
    this.blending = AdditiveBlending;
    this.depthWrite = false;
    this.forceSinglePass = true;
    this.side = DoubleSide;

    const streakIndex = float(instanceIndex);
    const base = streakIndex.mul(config.POINTS);
    const seed = hash(streakIndex);
    const variation = hash(streakIndex.add(config.VARIATION_SEED_OFFSET));
    const age = ssbo.ages.element(instanceIndex);
    const trailProgress = uv().y;
    const edgeDistance = uv().x.mul(2).sub(1).abs();
    const sideSign = uv().x.mul(2).sub(1);
    const lengthFactor = mix(0.6, 1, seed);
    const row = trailProgress.mul(config.SEGMENTS).mul(lengthFactor).round();

    const wrapGuard = config.POINTS * 2;
    const currentIndex = uniforms.uHead
      .sub(row)
      .add(wrapGuard)
      .mod(config.POINTS);
    const newerIndex = uniforms.uHead
      .sub(row.sub(1).max(0))
      .add(wrapGuard)
      .mod(config.POINTS);
    const currentPoint = ssbo.points.element(base.add(currentIndex)).xyz;
    const newerPoint = ssbo.points.element(base.add(newerIndex)).xyz;
    const position = mix(currentPoint, newerPoint, uniforms.uRecordPhase);

    const windForward = vec3(
      uniforms.uWindDirection.x,
      0,
      uniforms.uWindDirection.y,
    );
    const tangent = newerPoint.sub(currentPoint).add(windForward.mul(0.001));
    const viewDirection = cameraPosition.sub(position);
    const sideAxis = tangent.cross(viewDirection).normalize();

    const isAlive = step(0, age);
    const lifeProgress = age.div(config.STREAK_LIFETIME).clamp();
    const lifeFade = smoothstep(0, 0.1, lifeProgress).mul(
      float(1).sub(smoothstep(0.78, 1, lifeProgress)),
    );
    const fieldCenter = uniforms.uPlayerPosition.xz.add(
      uniforms.uWindDirection.mul(config.FORWARD_BIAS),
    );
    const relativeXZ = position.xz.sub(fieldCenter);
    const fieldDistance = relativeXZ.x.abs().max(relativeXZ.y.abs());
    const fieldFade = float(1).sub(
      smoothstep(
        config.FIELD_HALF_SIZE - config.EDGE_FADE_SIZE,
        config.FIELD_HALF_SIZE,
        fieldDistance,
      ),
    );
    const visibility = isAlive
      .mul(lifeFade)
      .mul(fieldFade)
      .mul(uniforms.uEffectFade);

    const widthEnvelope = smoothstep(0, 0.2, trailProgress).mul(
      float(1).sub(trailProgress).pow(1.5),
    );
    const width = uniforms.uWidth
      .mul(widthEnvelope)
      .mul(step(0.001, visibility));

    this.positionNode = position.add(sideAxis.mul(sideSign).mul(width));

    const edgeFade = float(1).sub(smoothstep(0.08, 0.92, edgeDistance));
    const headFade = float(1).sub(smoothstep(0.1, 1, trailProgress));
    const glowPhase = trailProgress
      .mul(PI2)
      .add(gameTime.mul(config.GLOW_SPEED))
      .add(seed.mul(PI2));
    const glow = sin(glowPhase).mul(0.5).add(0.5);
    const pulseFrequency = mix(0.4, 0.9, variation).mul(PI2);
    const speedPulse = float(1).add(
      sin(gameTime.mul(pulseFrequency).add(variation.mul(PI2))).mul(
        config.SPEED_PULSE,
      ),
    );
    this.colorNode = uniforms.uColor;
    this.opacityNode = float(0.09)
      .mul(visibility)
      .mul(edgeFade)
      .mul(mix(0.4, 1, headFade))
      .mul(mix(1 - config.GLOW_STRENGTH, 1 + config.GLOW_STRENGTH, glow))
      .mul(speedPulse);
  }
}
