import { assetManager } from "../../systems/AssetManager";
import { Color, Mesh } from "three";
import { sceneManager } from "../../systems/SceneManager";
import { MeshLambertNodeMaterial } from "three/webgpu";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physics } from "../../systems/Physics";

class TrunkMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;
    this.map = assetManager.trunkDiffuse;
    this.normalMap = assetManager.trunkNormal;
  }
}

class AxeMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;
    this.map = assetManager.axeDiffuse;
    this.emissiveMap = assetManager.axeEmissive;
    this.emissiveIntensity = 2;
    this.emissive = new Color("lightblue");
  }
}

export default class GodOfWar {
  constructor() {
    // Visual
    const axe = assetManager.realmModel.scene.getObjectByName(
      "kratos_axe",
    ) as Mesh;
    axe.material = new AxeMaterial();
    const trunk = assetManager.realmModel.scene.getObjectByName(
      "tree_trunk",
    ) as Mesh;
    trunk.material = new TrunkMaterial();
    sceneManager.scene.add(axe, trunk);

    // Physics
    const axeCollider = assetManager.realmModel.scene.getObjectByName(
      "axe_collider",
    ) as Mesh;
    const rigidBodyDescAxe = RigidBodyDesc.fixed()
      .setTranslation(...axeCollider.position.toArray())
      .setRotation(axeCollider.quaternion);
    const rigidBodyAxe = physics.world.createRigidBody(rigidBodyDescAxe);
    const max = axeCollider.geometry.boundingBox!.max;
    const colliderDescAxe = ColliderDesc.cuboid(
      max.x,
      max.y,
      max.z,
    ).setRestitution(0.15);
    physics.world.createCollider(colliderDescAxe, rigidBodyAxe);

    const trunkCollider = assetManager.realmModel.scene.getObjectByName(
      "trunk_collider",
    ) as Mesh;
    const { x, y } = trunkCollider.geometry.boundingBox!.max;
    const rigidBodyDescTrunk = RigidBodyDesc.fixed()
      .setTranslation(...trunkCollider.position.toArray())
      .setRotation(trunkCollider.quaternion);

    const rigidBodyTrunk = physics.world.createRigidBody(rigidBodyDescTrunk);
    const radius = x;
    const halfHeight = y / 2;
    const colliderDescTrunk = ColliderDesc.capsule(
      halfHeight,
      radius,
    ).setRestitution(0.15);
    physics.world.createCollider(colliderDescTrunk, rigidBodyTrunk);
  }
}
