import { DoubleSide, Mesh } from "three";
import {
  fract,
  hash,
  normalMap,
  positionLocal,
  positionWorld,
  sin,
  texture,
  uniform,
  uv,
  vec3,
  vertexIndex,
} from "three/tsl";
import { gameTime } from "../../utils/GameTime";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { assetManager, debugManager, sceneManager } from "../../systems";

const uniforms = {
  uWaveringSpeed: uniform(0.25),
  uWaveringStrength: uniform(0.1),
  uDiffuseScale: uniform(1),
  uNormalScale: uniform(1),
};

class WaterLylyMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.side = DoubleSide;

    const diffuse = texture(assetManager.resources.waterLilyDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.uDiffuseScale);
    this.opacityNode = diffuse.a;
    this.alphaTest = 0.5;

    const normal = texture(assetManager.resources.waterLilyNormal, uv());
    this.normalNode = normalMap(normal.rgb, uniforms.uNormalScale);

    const noise = texture(
      assetManager.resources.noiseAtlas,
      uv().add(gameTime).mul(uniforms.uWaveringSpeed),
    );

    const wavering = sin(noise.a).mul(uniforms.uWaveringStrength);

    this.positionNode = positionLocal.add(vec3(wavering, 0, wavering));
  }
}

export default class WaterLilies {
  constructor() {
    const mesh = assetManager.resources.worldModel.scene.getObjectByName(
      "water_lily",
    ) as Mesh;
    mesh.material = new WaterLylyMaterial();
    sceneManager.scene.add(mesh);

    this.debug();
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🪷 Water lilies",
      expanded: true,
    });

    folder.addBinding(uniforms.uWaveringSpeed, "value", {
      label: "Wavering speed",
      min: 0,
      max: 0.5,
      step: 0.0001,
    });

    folder.addBinding(uniforms.uWaveringStrength, "value", {
      label: "Wavering strength",
      min: 0,
      max: 5,
      step: 0.0001,
    });

    folder.addBinding(uniforms.uDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
      max: 5,
      step: 0.0001,
    });

    folder.addBinding(uniforms.uNormalScale, "value", {
      label: "Normal scale",
      min: 0,
      max: 5,
      step: 0.0001,
    });
  }
}
