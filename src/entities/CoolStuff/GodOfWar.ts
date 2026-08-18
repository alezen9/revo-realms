import {
  assetManager,
  debugManager,
  landmarkManager,
  physicsManager,
  windManager,
  sceneManager,
} from "../../systems";
import { ColliderDesc } from "@dimforge/rapier3d";
import { Mesh, Quaternion, Vector3 } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { color, normalMap, texture, uniform, uv } from "three/tsl";
import { RevoColliderType } from "../../types";

const uniforms = {
  uDiffuseScale: uniform(4),
  uNormalScale: uniform(1.25),
  uAoScale: uniform(0.75),
  uMetalnessScale: uniform(1),
  uRoughnessScale: uniform(1.5),
  uEmissionScale: uniform(42),
};

class LeviathanAxeMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();

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

    sceneManager.mainScene.add(axe);

    // Physics
    const scale = axe.scale.x;
    const headPosition = new Vector3(0.1, 0.05, 0)
      .multiplyScalar(scale)
      .applyQuaternion(axe.quaternion)
      .add(axe.position);
    const headRotation = new Quaternion()
      .setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 5)
      .premultiply(axe.quaternion);
    const headColliderDesc = ColliderDesc.cuboid(
      0.4 * scale,
      0.6 * scale,
      0.12 * scale,
    )
      .setTranslation(...headPosition.toArray())
      .setRotation(headRotation)
      .setRestitution(0.4);
    const headCollider = physicsManager.world.createCollider(headColliderDesc);
    headCollider.userData = {
      type: RevoColliderType.Stone,
    };

    const handlePosition = new Vector3(-1.5, -0.75, 0)
      .multiplyScalar(scale)
      .applyQuaternion(axe.quaternion)
      .add(axe.position);
    const handleRotation = new Quaternion()
      .setFromAxisAngle(new Vector3(0, 0, 1), 0.5 - Math.PI / 2)
      .premultiply(axe.quaternion);
    const handleColliderDesc = ColliderDesc.capsule(1.35 * scale, 0.2 * scale)
      .setTranslation(...handlePosition.toArray())
      .setRotation(handleRotation)
      .setRestitution(0.4);
    const handleCollider =
      physicsManager.world.createCollider(handleColliderDesc);
    handleCollider.userData = {
      type: RevoColliderType.Stone,
    };

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
