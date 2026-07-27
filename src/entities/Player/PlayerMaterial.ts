import {
  float,
  mix,
  normalMap,
  positionWorld,
  texture,
  uniform,
  uv,
} from "three/tsl";
import { MeshLambertNodeMaterial, Vector3 } from "three/webgpu";
import { assetManager, lightingManager } from "../../systems";
import { TSLUtils } from "../../utils/TSLUtils";
import { playerConfig as config } from "./config";

export const playerUniforms = {
  uSpinFactor: uniform(0),
  uSpinBlurMax: uniform(config.SPIN_BLUR_MAX),
  uPosition: uniform(new Vector3()),
  uRadius: uniform(config.RADIUS_IN_METERS),
};

export class PlayerMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.createMaterial();
  }

  private createMaterial() {
    const { DIFFUSE_BOOST } = config;
    const { SPIN_NORMAL_SCALE, SPIN_NORMAL_SCALE_MIN } = config;
    const { uSpinFactor, uSpinBlurMax } = playerUniforms;

    this.precision = "lowp";
    this.flatShading = false;

    const blurAmount = uSpinFactor.mul(uSpinBlurMax);

    const baseColor = texture(assetManager.resources.playerDiffuse, uv())
      .blur(blurAmount)
      .mul(DIFFUSE_BOOST);
    const terrainMapUv = TSLUtils.computeMapUvByPosition(positionWorld.xz);
    const bakedShadowFactor = texture(
      assetManager.resources.terrainMaps,
      terrainMapUv,
    ).r;
    this.colorNode = mix(
      baseColor.mul(lightingManager.uBakedShadowBrightness),
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
