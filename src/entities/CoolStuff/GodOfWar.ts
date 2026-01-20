import {
  assetManager,
  debugManager,
  landmarkManager,
  windManager,
} from "../../systems";
import { Mesh } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physicsManager, sceneManager } from "../../systems";
import { RevoColliderType } from "../../types";
import { color, normalMap, texture, uniform, uv, vec3 } from "three/tsl";

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
    this.debug();

    // Visual
    const axe = assetManager.resources.worldModel.scene.getObjectByName(
      "leviathan_axe",
    ) as Mesh;
    axe.material = new LeviathanAxeMaterial();

    sceneManager.scene.add(axe);

    // // Physics
    // const axeCollider = assetManager.resources.worldModel.scene.getObjectByName(
    //   "axe_collider",
    // ) as Mesh;
    // const rigidBodyDescAxe = RigidBodyDesc.fixed()
    //   .setTranslation(...axeCollider.position.toArray())
    //   .setRotation(axeCollider.quaternion)
    //   .setUserData({ type: RevoColliderType.Wood });

    // const rigidBodyAxe = physicsManager.world.createRigidBody(rigidBodyDescAxe);
    // const max = axeCollider.geometry.boundingBox!.max;
    // const colliderDescAxe = ColliderDesc.cuboid(
    //   max.x,
    //   max.y,
    //   max.z,
    // ).setRestitution(0.75);
    // physicsManager.world.createCollider(colliderDescAxe, rigidBodyAxe);

    // const trunkCollider =
    //   assetManager.resources.worldModel.scene.getObjectByName(
    //     "trunk_collider",
    //   ) as Mesh;
    // const { x, y } = trunkCollider.geometry.boundingBox!.max;
    // const rigidBodyDescTrunk = RigidBodyDesc.fixed()
    //   .setTranslation(...trunkCollider.position.toArray())
    //   .setRotation(trunkCollider.quaternion)
    //   .setUserData({ type: RevoColliderType.Wood });

    // const rigidBodyTrunk =
    //   physicsManager.world.createRigidBody(rigidBodyDescTrunk);
    // const radius = x;
    // const halfHeight = y / 2;
    // const colliderDescTrunk = ColliderDesc.capsule(
    //   halfHeight,
    //   radius,
    // ).setRestitution(0.75);
    // physicsManager.world.createCollider(colliderDescTrunk, rigidBodyTrunk);

    // Register landmark for radial menu discovery
    const landmarkId = landmarkManager.register({
      name: "Leviathan Axe",
      icon: "🪓",
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
