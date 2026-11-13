import { float, mix, mrt, normalWorld, texture, uv, vec4 } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assets, lighting } from "../../systems";
import { uniforms } from "./LakeRocksConfig";

export class LakeRocksMaterial extends MeshBasicNodeMaterial {
  constructor() {
    super();
    const rockUv = uv().mul(uniforms.uUvScale);
    const diffuse = texture(assets.resources.lakeRocksDiffuse, rockUv);
    const facingSun = normalWorld.dot(lighting.uSunDir.negate()).saturate();
    const shade = mix(float(1).sub(uniforms.uShadeDepth), 1, facingSun);
    const rockColor = diffuse.rgb.mul(uniforms.uDiffuseScale).mul(shade);
    this.colorNode = rockColor;

    const hemiRadiance = lighting.uHemiSkyColor.rgb.add(
      lighting.uHemiGroundColor.rgb,
    );
    const ambientRadiance = hemiRadiance.mul(lighting.uHemiIntensity.mul(0.5));
    const sunRadiance = lighting.uSunRadiance.rgb;
    const totalRadiance = sunRadiance.add(ambientRadiance).max(0.0001);
    const directFraction = sunRadiance.div(totalRadiance);
    this.mrtNode = mrt({
      directSun: vec4(rockColor.mul(directFraction), 1),
    });
  }
}
