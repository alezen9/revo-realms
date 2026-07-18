import { Color, DoubleSide } from "three";
import {
  float,
  Fn,
  hash,
  instancedArray,
  instanceIndex,
  mix,
  PI,
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
  uColor: uniform(new Color().setRGB(0.62, 0.7, 0.64)),
  uSpeed: uniform(0.3),
  uHeight: uniform(7),
  uLength: uniform(48),
};

const getConfig = () => {
  const RIBBON_COUNT = 24;
  const RIBBON_SEGMENTS = 36;
  const FIELD_SIZE = 170;

  return {
    RIBBON_COUNT,
    RIBBON_SEGMENTS,
    FIELD_SIZE,
    FIELD_HALF_SIZE: FIELD_SIZE / 2,
    EDGE_FADE_SIZE: 18,
    GROUND_CLEARANCE: 0.16,
    RIBBON_LIFETIME: 6.4,
    RIBBON_SPEED: 30,
    RESPAWN_DELAY: 1.6,
    DISTRIBUTION_STEP: (Math.sqrt(5) - 1) / 2,
    VARIATION_SEED_OFFSET: 2048,
    FLOW_MIP_LEVEL: 2,
    FLOW_NOISE_SCALE: 0.007,
    FLOW_SCROLL_X: 0.012,
    FLOW_SCROLL_Y: 0.008,
    WAVE_FREQUENCY: 0.4,
    WAVE_AMPLITUDE: 1.2,
    WAVE_TRAVEL_SPEED: 1.5,
    BEND_SIDE: 2.5,
    BEND_VERTICAL: 0.8,
    ACTIVE_INTENSITY_THRESHOLD: 0.24,
    FADE_IN_RATE: 1.25,
    FADE_OUT_RATE: 0.85,
    WORKGROUP_SIZE: 64,
  };
};

const config = getConfig();

class WindRibbonsSsbo {
  readonly positions = instancedArray(config.RIBBON_COUNT, "vec4");
  readonly motion = instancedArray(config.RIBBON_COUNT, "vec2");

  constructor() {
    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
  }

  private computeInit = Fn(() => {
    const data = this.positions.element(instanceIndex);
    const motion = this.motion.element(instanceIndex);
    const ribbonIndex = float(instanceIndex);
    const seed = hash(ribbonIndex);
    const variation = hash(ribbonIndex.add(config.VARIATION_SEED_OFFSET));
    const offsetX = ribbonIndex
      .mul(config.DISTRIBUTION_STEP)
      .fract()
      .sub(0.5)
      .mul(config.FIELD_SIZE);
    const offsetZ = ribbonIndex
      .add(seed)
      .div(config.RIBBON_COUNT)
      .sub(0.5)
      .mul(config.FIELD_SIZE);
    const worldPosition = vec3(offsetX, 0, offsetZ).add(
      uniforms.uPlayerPosition,
    );
    const terrainHeight = VegetationSsboUtils.computeYOffset(worldPosition);
    const ribbonLift = uniforms.uHeight.mul(mix(0.08, 0.32, variation));
    const age = seed
      .mul(config.RIBBON_LIFETIME + config.RESPAWN_DELAY)
      .sub(config.RESPAWN_DELAY);

    data.assign(
      vec4(
        worldPosition.x,
        terrainHeight.add(ribbonLift).add(config.GROUND_CLEARANCE),
        worldPosition.z,
        age,
      ),
    );
    motion.assign(vec2(0.5));
  })().compute(config.RIBBON_COUNT, [config.WORKGROUP_SIZE]);

  readonly computeUpdate = Fn(() => {
    const data = this.positions.element(instanceIndex);
    const motion = this.motion.element(instanceIndex);
    const ribbonIndex = float(instanceIndex);
    const windDirection = uniforms.uWindDirection;
    const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
    const relativePosition = data.xz.sub(uniforms.uPlayerPosition.xz);
    const age = data.w.add(uniforms.uDelta.mul(uniforms.uSpeed));
    const isAlive = step(0, age);
    const lifeProgress = age.div(config.RIBBON_LIFETIME).clamp();
    const seed = hash(ribbonIndex);
    const variation = hash(ribbonIndex.add(config.VARIATION_SEED_OFFSET));
    const flowScroll = vec2(
      gameTime.mul(config.FLOW_SCROLL_X),
      gameTime.mul(config.FLOW_SCROLL_Y),
    );
    const flowUv = data.xz.mul(config.FLOW_NOISE_SCALE).add(flowScroll);
    const flow = texture(
      assetManager.resources.noiseAtlas,
      flowUv,
      config.FLOW_MIP_LEVEL,
    );
    const noiseSide = flow.g.mul(2).sub(1);
    const seedSide = variation.mul(2).sub(1);
    const sideFlow = mix(seedSide, noiseSide, 0.75);
    const sideVelocity = sideFlow
      .mul(6)
      .mul(uniforms.uSpeed)
      .mul(windManager.uIntensityDirectional);
    const speedVariation = mix(0.88, 1.12, seed);
    const gustSpeed = mix(0.86, 1.14, flow.r);
    const ageSpeed = mix(1.45, 0.7, lifeProgress);
    const forwardVelocity = float(config.RIBBON_SPEED)
      .mul(uniforms.uSpeed)
      .mul(speedVariation)
      .mul(gustSpeed)
      .mul(ageSpeed);
    const forwardMovement = windDirection.mul(forwardVelocity);
    const sideMovement = sideDirection.mul(sideVelocity);
    const velocity = forwardMovement.add(sideMovement);
    const movement = velocity.mul(uniforms.uDelta).mul(isAlive);
    const nextXZ = relativePosition.add(movement);
    const expired = step(config.RIBBON_LIFETIME, age);
    const wrappedXZ = VegetationSsboUtils.wrapPosition(
      nextXZ,
      vec2(0),
      config.FIELD_SIZE,
    ).xz;
    const finalXZ = wrappedXZ.add(uniforms.uPlayerPosition.xz);
    const worldPosition = vec3(finalXZ.x, 0, finalXZ.y);
    const terrainHeight = VegetationSsboUtils.computeYOffset(worldPosition);
    const ribbonLift = uniforms.uHeight.mul(mix(0.08, 0.32, variation));
    const respawnDelay = variation.mul(config.RESPAWN_DELAY).negate();

    data.x = finalXZ.x;
    data.y = terrainHeight.add(ribbonLift).add(config.GROUND_CLEARANCE);
    data.z = finalXZ.y;
    data.w = mix(age, respawnDelay, expired);
    motion.assign(flow.rg);
  })().compute(config.RIBBON_COUNT, [config.WORKGROUP_SIZE]);
}

export default class WindAmbianceRibbons {
  private ssbo = new WindRibbonsSsbo();
  private mesh: InstancedMesh;
  private isComputeInFlight = false;
  private effectFade = 0;
  private pendingDelta = 0;

  constructor() {
    this.mesh = this.createMesh();
    sceneManager.scene.add(this.mesh);
    this.registerPrewarmTask();
    this.debug();
    eventsManager.on("engine-render-update", this.onEngineUpdate);
  }

  private createMesh() {
    const mesh = new InstancedMesh(
      new PlaneGeometry(1, 1, 1, config.RIBBON_SEGMENTS),
      new WindRibbonMaterial(this.ssbo),
      config.RIBBON_COUNT,
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

    // direction is latched only while fully invisible, so ribbons never
    // rotate on screen: stale direction forces a fade out, then fade back in
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
    uniforms.uDelta.value = this.pendingDelta;
    this.pendingDelta = 0;
    try {
      await rendererManager.renderer.computeAsync(this.ssbo.computeUpdate);
    } catch (error) {
      console.error("[WindAmbianceRibbons] computeAsync failed:", error);
    } finally {
      this.isComputeInFlight = false;
    }
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🌬️ Wind ribbons",
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
    folder.addBinding(uniforms.uLength, "value", {
      label: "Length",
      min: 10,
      max: 80,
      step: 1,
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

class WindRibbonMaterial extends MeshBasicNodeMaterial {
  constructor(ssbo: WindRibbonsSsbo) {
    super();

    this.precision = "lowp";
    this.transparent = true;
    this.depthWrite = false;
    this.forceSinglePass = true;
    this.side = DoubleSide;

    const data = ssbo.positions.element(instanceIndex);
    const motion = ssbo.motion.element(instanceIndex);
    const ribbonIndex = float(instanceIndex);
    const ribbonAge = data.w;
    const seed = hash(ribbonIndex);
    const variation = hash(ribbonIndex.add(config.VARIATION_SEED_OFFSET));
    const windDirection = uniforms.uWindDirection;
    const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
    const windForward = vec3(windDirection.x, 0, windDirection.y);
    const windSide = vec3(sideDirection.x, 0, sideDirection.y);
    const curveProgress = uv().y;
    const edgeDistance = uv().x.mul(2).sub(1).abs();
    const sideSign = uv().x.mul(2).sub(1);
    const isAlive = step(0, ribbonAge);
    const lifeProgress = ribbonAge.div(config.RIBBON_LIFETIME).clamp();
    const lifeFade = smoothstep(0, 0.1, lifeProgress).mul(
      float(1).sub(smoothstep(0.78, 1, lifeProgress)),
    );
    const relativeXZ = data.xz.sub(uniforms.uPlayerPosition.xz);
    const fieldDistance = relativeXZ.x.abs().max(relativeXZ.y.abs());
    const fieldFade = float(1).sub(
      smoothstep(
        config.FIELD_HALF_SIZE - config.EDGE_FADE_SIZE,
        config.FIELD_HALF_SIZE,
        fieldDistance,
      ),
    );
    const ribbonVisibility = isAlive
      .mul(lifeFade)
      .mul(fieldFade)
      .mul(uniforms.uEffectFade);
    const centeredProgress = curveProgress.sub(0.5);
    const bodyEnvelope = sin(curveProgress.mul(PI)).clamp();
    const ribbonLength = uniforms.uLength.mul(mix(0.65, 1.4, seed));
    const sideBias = seed.mul(2).sub(1);
    const verticalBias = variation.mul(2).sub(1);
    const noiseBend = motion.mul(2).sub(1);
    const seedBend = vec2(sideBias, verticalBias);
    const oppositeSideBias = sideBias.negate();
    const twistDirection = vec2(verticalBias, oppositeSideBias);
    const twist = twistDirection.mul(centeredProgress);
    const bend = seedBend
      .mul(0.35)
      .add(noiseBend.mul(0.45))
      .add(twist.mul(0.2));
    const waveFrequency = mix(0.8, 1.2, seed).mul(config.WAVE_FREQUENCY);
    const wavePhase = curveProgress
      .mul(waveFrequency)
      .mul(PI2)
      .add(seed.mul(PI2))
      .sub(gameTime.mul(config.WAVE_TRAVEL_SPEED));
    const waveAmplitude = mix(0.6, 1.4, variation).mul(config.WAVE_AMPLITUDE);
    const sideWave = sin(wavePhase).mul(waveAmplitude);
    const verticalWave = sin(wavePhase.mul(1.35).add(variation.mul(PI2)))
      .mul(waveAmplitude)
      .mul(0.6);
    const sideOffset = bodyEnvelope.mul(
      bend.x.mul(config.BEND_SIDE).add(sideWave),
    );
    const heightOffset = bodyEnvelope.mul(
      bend.y.mul(config.BEND_VERTICAL).add(verticalWave),
    );
    const centerOffset = windForward
      .mul(centeredProgress.mul(ribbonLength))
      .add(windSide.mul(sideOffset))
      .add(vec3(0, heightOffset, 0));
    const widthTilt = bend.y.mul(0.06);
    const widthAxis = windSide.add(vec3(0, widthTilt, 0)).normalize();
    const ribbonWidth = bodyEnvelope
      .mul(mix(0.75, 1.35, variation))
      .mul(ribbonLength)
      .mul(0.0058)
      .mul(step(0.001, ribbonVisibility));

    this.positionNode = data.xyz
      .add(centerOffset)
      .add(widthAxis.mul(sideSign).mul(ribbonWidth));

    const edgeFade = float(1).sub(smoothstep(0.08, 0.92, edgeDistance));
    this.colorNode = uniforms.uColor;
    this.opacityNode = float(0.06)
      .mul(ribbonVisibility)
      .mul(edgeFade)
      .mul(mix(0.88, 1.08, motion.x));
  }
}
