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
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { type Node } from "three/webgpu";
import { VSMReceiverLambertMaterial } from "../../systems/vsm/VSMReceiverMaterials";
import { shadeGrassGround } from "../grass/GrassShading";
import { assets } from "../../systems";
import { gameTime } from "../../systems/time/gameTime";
import { computeMapUvByPosition } from "../../shaders/mapping";
import { config, uniforms } from "./terrainConfig";

const { GRASS_GROUND_SOFTNESS } = config;

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
      const depthFade = float(1).sub(depthFalloff);
      const adjustedCaustics = causticsCubed.mul(depthFade);
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
  }

  private createMaterial() {
    const worldUv = computeMapUvByPosition(positionWorld.xz);
    const mapUv = varying(worldUv);
    const terrainMapSample = texture(assets.resources.terrainMasks, mapUv);
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
      assets.resources.woodChipsNormalAo,
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
    const dryMask = float(1).sub(waterMask);
    const groundWeight = grassBlend.mul(dryMask);
    const ground = shadeGrassGround({
      albedo: vec3(1).mul(uniforms.uGrassGroundColor),
      normal: normalWorld,
      geometryNormal: normalWorldGeometry,
      worldPosition: positionWorld,
    });
    const surfaceWeight = float(1).sub(groundWeight);
    this.colorNode = surfaceColor.mul(surfaceWeight);
    this.emissiveNode = ground.color.mul(groundWeight);
    this.extraDirectSun = ground.directSun.mul(groundWeight);
  }
}
