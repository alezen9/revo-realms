import {
  float,
  mix,
  normalMap,
  normalWorld,
  positionWorld,
  texture,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { MeshLambertNodeMaterial, Vector3 } from "three/webgpu";
import { assetManager, lightingManager } from "../../systems";
import { TSLUtils } from "../../utils/TSLUtils";
import { playerConfig as config } from "./config";

export const playerUniforms = {
  uDiffuseScale: uniform(config.DIFFUSE_BOOST),
  uSpinFactor: uniform(0),
  uSpinBlurMax: uniform(config.SPIN_BLUR_MAX),
  uPosition: uniform(new Vector3()),
  uRadius: uniform(config.RADIUS_IN_METERS),
  uSunTintStrength: uniform(0.22),
};

export class PlayerMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.createMaterial();
  }

  private createMaterial() {
    const { SPIN_NORMAL_SCALE, SPIN_NORMAL_SCALE_MIN } = config;
    const { uDiffuseScale, uSpinFactor, uSpinBlurMax, uSunTintStrength } =
      playerUniforms;

    this.precision = "lowp";
    this.flatShading = false;

    const blurAmount = uSpinFactor.mul(uSpinBlurMax);

    const baseColor = texture(assetManager.resources.playerDiffuse, uv())
      .blur(blurAmount)
      .mul(uDiffuseScale);
    const terrainMapUv = TSLUtils.computeMapUvByPosition(positionWorld.xz);
    const bakedShadowFactor = texture(
      assetManager.resources.terrainMaps,
      terrainMapUv,
    ).r;
    const shadowedColor = mix(
      baseColor.mul(lightingManager.uBakedShadowBrightness),
      baseColor,
      bakedShadowFactor,
    );
    const sunFacing = normalWorld.dot(lightingManager.uSunDir.negate()).clamp();
    const sunTint = mix(
      vec3(1),
      lightingManager.uSunColor,
      sunFacing.mul(uSunTintStrength),
    );
    this.colorNode = shadowedColor.mul(sunTint);

    const normal = texture(assetManager.resources.playerNormal, uv()).blur(
      blurAmount,
    );
    const normalScale = mix(
      float(SPIN_NORMAL_SCALE),
      float(SPIN_NORMAL_SCALE_MIN),
      uSpinFactor,
    );
    this.normalNode = normalMap(normal, normalScale);
  }
}
