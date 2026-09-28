import {
  float,
  Fn,
  If,
  mix,
  normalMap,
  normalWorld,
  normalWorldGeometry,
  positionWorld,
  smoothstep,
  texture,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { Color, type Node } from "three/webgpu";
import { VSMReceiverLambertMaterial } from "../../systems/vsm/VSMReceiverMaterials";
import { shadeGrassGround } from "../grass/GrassShading";
import { assets, debugPanel } from "../../systems";
import { gameTime } from "../../systems/time/gameTime";
import { srgbColorTarget } from "../../systems/debug/tweakpaneColor";
import { computeMapUvByPosition } from "../../shaders/mapping";

const GRASS_GROUND_SOFTNESS = 0.25;

const uniforms = {
  uGrassGroundColor: uniform(new Color(0.25, 0.27, 0.18).convertSRGBToLinear()),
  uUnderwaterSandColor: uniform(
    new Color(0.95, 0.87, 0.68).convertSRGBToLinear(),
  ),
  uSandColor: uniform(new Color(0.9, 0.82, 0.65).convertSRGBToLinear()),
  uGrassNormalScale: uniform(1),
  uSandNormalScale: uniform(1),
  uWaterNormalScale: uniform(0.35),
  uCausticsHighlightScale: uniform(0.4),
  uCausticsUv1Scale: uniform(31.53),
  uCausticsUv2Scale: uniform(58.71),
};

type CausticsArgs = [
  mapUv: Node<"vec2">,
  waterDepth: Node<"float">,
  waterMask: Node<"float">,
];

const computeCausticsColor = Fn<CausticsArgs, Node<"vec3">>(
  ([mapUv, waterDepth, waterMask]) => {
    const causticsColor = vec3(0).toVar();
    If(waterMask, () => {
      const causticsTime = gameTime.mul(0.15);
      const causticsUv1 = mapUv
        .mul(uniforms.uCausticsUv1Scale)
        .add(vec2(causticsTime, 0))
        .fract();
      const noiseA = texture(assets.resources.noiseAtlas, causticsUv1, 1).a;
      const causticsUv2 = mapUv
        .mul(uniforms.uCausticsUv2Scale)
        .add(vec2(0, causticsTime.negate()))
        .fract();
      const noiseB = texture(assets.resources.noiseAtlas, causticsUv2, 3).a;
      const caustics = noiseA.add(noiseB);
      const causticsCubed = caustics.mul(caustics).mul(caustics);
      const depthFalloff = smoothstep(-1, 7.5, waterDepth);
      const adjustedCaustics = causticsCubed.mul(float(1).sub(depthFalloff));
      const causticsHighlightColor = vec3(0.3, 0.4, 0.5).mul(
        uniforms.uCausticsHighlightScale,
      );
      causticsColor.assign(causticsHighlightColor.mul(adjustedCaustics));
    });
    return causticsColor;
  },
);

export class TerrainMaterial extends VSMReceiverLambertMaterial {
  constructor() {
    super();
    this.createMaterial();
    this.debugTerrain();
  }

  private createMaterial() {
    const worldUv = computeMapUvByPosition(positionWorld.xz);
    const mapUv = varying(worldUv);
    const terrainMapSample = texture(assets.resources.terrainMaps, mapUv);
    const grassMask = terrainMapSample.g;
    const grassBlend = smoothstep(0.05, 0.35, grassMask);
    this.softShadowNode = grassBlend.mul(GRASS_GROUND_SOFTNESS);
    const waterMask = terrainMapSample.b;
    const waterDepth = positionWorld.y.negate();
    const waterDepthBlend = smoothstep(0, 8, waterDepth);
    const waterTint = vec3(0.35, 0.45, 0.55).mul(0.65);
    const causticsColor = computeCausticsColor(mapUv, waterDepth, waterMask);
    const shallowBoost = smoothstep(0, 1.5, waterDepth);
    const sandHighlight = vec3(1, 0.9, 0.7).mul(0.1).mul(shallowBoost);
    const waterBaseColor = mix(
      uniforms.uUnderwaterSandColor,
      waterTint,
      waterDepthBlend,
    ).add(sandHighlight);
    const waterColor = waterBaseColor.add(causticsColor);
    const surfaceColor = mix(uniforms.uSandColor, waterColor, waterMask);
    const normalAoSample = texture(
      assets.resources.terrainNormAo,
      mapUv.mul(41.7),
    );
    const landNormalScale = mix(
      uniforms.uSandNormalScale,
      uniforms.uGrassNormalScale,
      grassBlend,
    );
    const normalScale = mix(
      landNormalScale,
      uniforms.uWaterNormalScale,
      waterMask,
    );
    this.normalNode = normalMap(normalAoSample.rgb, normalScale);
    this.aoNode = normalAoSample.a;
    const groundWeight = grassBlend.mul(float(1).sub(waterMask));
    const ground = shadeGrassGround({
      albedo: vec3(1).mul(uniforms.uGrassGroundColor),
      normal: normalWorld,
      geometryNormal: normalWorldGeometry,
      worldPosition: positionWorld,
    });
    this.colorNode = surfaceColor.mul(float(1).sub(groundWeight));
    this.emissiveNode = ground.color.mul(groundWeight);
    this.extraDirectSun = ground.directSun.mul(groundWeight);
  }

  private debugTerrain() {
    const folder = debugPanel.panel.addFolder({
      title: "⛰️ Terrain",
      expanded: false,
    });
    const color = folder.addFolder({
      title: "Color",
    });
    color.addBinding(
      srgbColorTarget(uniforms.uGrassGroundColor.value),
      "value",
      {
        label: "Grass ground",
        view: "color",
        color: { type: "float" },
      },
    );
    color.addBinding(srgbColorTarget(uniforms.uSandColor.value), "value", {
      label: "Sand",
      view: "color",
      color: { type: "float" },
    });
    color.addBinding(
      srgbColorTarget(uniforms.uUnderwaterSandColor.value),
      "value",
      {
        label: "Underwater sand",
        view: "color",
        color: { type: "float" },
      },
    );
    const normal = folder.addFolder({
      title: "Normal scale",
    });
    normal.addBinding(uniforms.uSandNormalScale, "value", {
      label: "Sand",
    });
    normal.addBinding(uniforms.uGrassNormalScale, "value", {
      label: "Grass",
    });
    normal.addBinding(uniforms.uWaterNormalScale, "value", {
      label: "Water",
    });
    const caustics = folder.addFolder({
      title: "Caustics",
    });
    caustics.addBinding(uniforms.uCausticsUv1Scale, "value", {
      label: "UV 1 scale",
      min: 0,
      max: 100,
      step: 0.001,
    });
    caustics.addBinding(uniforms.uCausticsUv2Scale, "value", {
      label: "UV 2 scale",
      min: 0,
      max: 100,
      step: 0.001,
    });
    caustics.addBinding(uniforms.uCausticsHighlightScale, "value", {
      label: "Highlight scale",
      min: 0,
      max: 1,
      step: 0.001,
    });
  }
}
