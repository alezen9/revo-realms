import { assetManager, debugManager } from "../../systems";
import { Mesh } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physicsManager, sceneManager } from "../../systems";
import { RevoColliderType } from "../../types";
import { color, normalMap, texture, uniform, uv, vec3 } from "three/tsl";

const uniforms = {
  diffuseScale: uniform(4),
  normalScale: uniform(1.25),
  aoScale: uniform(1),
  metalnessScale: uniform(1),
  roughnessScale: uniform(1.5),
  emissionScale: uniform(10),
};

class LeviathanAxeMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();

    this.debug();

    this.precision = "lowp";
    this.flatShading = false;

    const diffuseEmission = texture(
      assetManager.resources.leviathanDiffuseEmissive,
      uv(),
    );
    this.colorNode = diffuseEmission.rgb.mul(uniforms.diffuseScale);

    const emissive = color("lightblue")
      .mul(diffuseEmission.a)
      .mul(uniforms.emissionScale);
    this.emissiveNode = emissive;

    const normal = texture(assetManager.resources.leviathanNormal, uv());
    this.normalNode = normalMap(normal, uniforms.normalScale);

    const orm = texture(assetManager.resources.leviathanORM, uv());
    this.aoNode = orm.r.mul(uniforms.aoScale);
    this.metalnessNode = orm.b.mul(uniforms.metalnessScale);
    this.roughnessNode = orm.g.mul(uniforms.roughnessScale);
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🪓 God of War",
      expanded: false,
    });
    folder.addBinding(uniforms.diffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
    folder.addBinding(uniforms.normalScale, "value", {
      label: "Normal scale",
      min: 0,
    });
    folder.addBinding(uniforms.emissionScale, "value", {
      label: "Emission scale",
      min: 0,
    });
    folder.addBinding(uniforms.aoScale, "value", {
      label: "AO scale",
      min: 0,
    });
    folder.addBinding(uniforms.metalnessScale, "value", {
      label: "Metalness scale",
      min: 0,
    });
    folder.addBinding(uniforms.roughnessScale, "value", {
      label: "Roughness scale",
      min: 0,
    });
  }
}

export default class GodOfWar {
  constructor() {
    // Visual
    const leviathanAxe =
      assetManager.resources.worldModel.scene.getObjectByName(
        "leviathan_axe",
      ) as Mesh;
    leviathanAxe.material = new LeviathanAxeMaterial();

    sceneManager.scene.add(leviathanAxe);

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
  }
}
