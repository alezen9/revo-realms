import { assetManager } from "../../systems";
import { Mesh } from "three";
import {
  MeshLambertNodeMaterial,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physicsManager, sceneManager } from "../../systems";
import { RevoColliderType } from "../../types";
import { color, texture, uv } from "three/tsl";

class TrunkMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;
    const diffuse = texture(assetManager.resources.godOfWarTrunkDiffuse, uv());
    this.colorNode = diffuse.mul(1.75);
    this.normalMap = assetManager.resources.godOfWarTrunkNormal;
  }
}

class AxeMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;
    const sample = texture(assetManager.resources.godOfWarAxeDiffuse, uv());
    const diffuse = sample.rgb;
    const emissive = color("lightblue").mul(55).mul(sample.a);
    this.colorNode = diffuse;
    this.emissiveNode = emissive;
  }
}

export default class GodOfWar {
  constructor() {
    // Visual
    const axe = assetManager.resources.realmModel.scene.getObjectByName(
      "kratos_axe",
    ) as Mesh;
    axe.material = new AxeMaterial();

    const trunk = assetManager.resources.realmModel.scene.getObjectByName(
      "tree_trunk",
    ) as Mesh;
    trunk.material = new TrunkMaterial();
    sceneManager.scene.add(axe, trunk);

    // Physics
    const axeCollider = assetManager.resources.realmModel.scene.getObjectByName(
      "axe_collider",
    ) as Mesh;
    const rigidBodyDescAxe = RigidBodyDesc.fixed()
      .setTranslation(...axeCollider.position.toArray())
      .setRotation(axeCollider.quaternion)
      .setUserData({ type: RevoColliderType.Wood });

    const rigidBodyAxe = physicsManager.world.createRigidBody(rigidBodyDescAxe);
    const max = axeCollider.geometry.boundingBox!.max;
    const colliderDescAxe = ColliderDesc.cuboid(
      max.x,
      max.y,
      max.z,
    ).setRestitution(0.75);
    physicsManager.world.createCollider(colliderDescAxe, rigidBodyAxe);

    const trunkCollider =
      assetManager.resources.realmModel.scene.getObjectByName(
        "trunk_collider",
      ) as Mesh;
    const { x, y } = trunkCollider.geometry.boundingBox!.max;
    const rigidBodyDescTrunk = RigidBodyDesc.fixed()
      .setTranslation(...trunkCollider.position.toArray())
      .setRotation(trunkCollider.quaternion)
      .setUserData({ type: RevoColliderType.Wood });

    const rigidBodyTrunk =
      physicsManager.world.createRigidBody(rigidBodyDescTrunk);
    const radius = x;
    const halfHeight = y / 2;
    const colliderDescTrunk = ColliderDesc.capsule(
      halfHeight,
      radius,
    ).setRestitution(0.75);
    physicsManager.world.createCollider(colliderDescTrunk, rigidBodyTrunk);
  }
}
