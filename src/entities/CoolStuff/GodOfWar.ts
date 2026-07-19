import {
  assetManager,
  debugManager,
  landmarkManager,
  windManager,
  sceneManager,
} from "../../systems";
import { Mesh } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { color, normalMap, texture, uniform, uv } from "three/tsl";

const uniforms = {
  uDiffuseScale: uniform(4),
  uNormalScale: uniform(1.25),
  uAoScale: uniform(1),
  uMetalnessScale: uniform(1),
  uRoughnessScale: uniform(1.5),
  uEmissionScale: uniform(10),
};

class LeviathanAxeMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";

    const diffuseEmission = texture(
      assetManager.resources.leviathanAxeDiffuseEmissive,
      uv(),
    );
    this.colorNode = diffuseEmission.rgb.mul(uniforms.uDiffuseScale);

    const emissive = color("lightblue")
      .mul(diffuseEmission.a)
      .mul(uniforms.uEmissionScale);
    this.emissiveNode = emissive;

    const normal = texture(assetManager.resources.leviathanAxeNormal, uv());
    this.normalNode = normalMap(normal, uniforms.uNormalScale);

    const orm = texture(assetManager.resources.leviathanAxeORM, uv());
    this.aoNode = orm.r.mul(uniforms.uAoScale);
    this.metalnessNode = orm.b.mul(uniforms.uMetalnessScale);
    this.roughnessNode = orm.g.mul(uniforms.uRoughnessScale);
  }
}

export default class GodOfWar {
  constructor() {
    // Visual
    const axe = assetManager.resources.worldModel.scene.getObjectByName(
      "leviathan_axe",
    ) as Mesh;
    axe.material = new LeviathanAxeMaterial();

    sceneManager.scene.add(axe);

    // Register landmark for radial menu discovery
    const landmarkId = landmarkManager.register({
      name: "Leviathan Axe",
      icon: "axe",
      position: axe.position,
      discoveryRadius: 80,
      arrivalRadius: 20,
    });

    // Register wind target and link to landmark
    const windTargetId = windManager.registerTarget(
      "Leviathan Axe",
      axe.position,
      20,
    );
    landmarkManager.setWindTargetId(landmarkId, windTargetId);
    this.debug();
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🪓 God of War",
      expanded: false,
    });
    folder.addBinding(uniforms.uDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
    folder.addBinding(uniforms.uNormalScale, "value", {
      label: "Normal scale",
      min: 0,
    });
    folder.addBinding(uniforms.uEmissionScale, "value", {
      label: "Emission scale",
      min: 0,
    });
    folder.addBinding(uniforms.uAoScale, "value", {
      label: "AO scale",
      min: 0,
    });
    folder.addBinding(uniforms.uMetalnessScale, "value", {
      label: "Metalness scale",
      min: 0,
    });
    folder.addBinding(uniforms.uRoughnessScale, "value", {
      label: "Roughness scale",
      min: 0,
    });
  }
}
