import {
  float,
  mix,
  normalMap,
  positionWorld,
  texture,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { MeshLambertNodeMaterial } from "three/webgpu";
import { assetManager } from "../../systems";
import { TSLUtils } from "../../utils/TSLUtils";
import { playerConfig as config } from "./config";

export const playerUniforms = {
  uSpinFactor: uniform(0),
  uSpinBlurMax: uniform(config.SPIN_BLUR_MAX),
};

export class PlayerMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.createMaterial();
  }

  private createMaterial() {
    const { DIFFUSE_BOOST, SHADOWED_DIFFUSE_FACTOR, CAST_SHADOW_OPACITY } =
      config;
    const { SPIN_NORMAL_SCALE, SPIN_NORMAL_SCALE_MIN } = config;
    const { uSpinFactor, uSpinBlurMax } = playerUniforms;

    this.precision = "lowp";
    this.flatShading = false;
    this.castShadowNode = vec3(CAST_SHADOW_OPACITY);

    const blurAmount = uSpinFactor.mul(uSpinBlurMax);

    const baseColor = texture(assetManager.resources.playerDiffuse, uv())
      .blur(blurAmount)
      .mul(DIFFUSE_BOOST);
    const bakedShadowFactor = TSLUtils.getBakedShadowFactor(positionWorld.xz);
    this.colorNode = mix(
      baseColor.mul(SHADOWED_DIFFUSE_FACTOR),
      baseColor,
      bakedShadowFactor,
    );

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
