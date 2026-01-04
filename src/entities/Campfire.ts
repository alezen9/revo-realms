import { Mesh } from "three";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { RevoColliderType } from "../types";
import ParticleSystem from "../utils/ParticleSystem";
import {
  assetManager,
  sceneManager,
  physicsManager,
  debugManager,
} from "../systems";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { normalMap, texture, uv } from "three/tsl";

class CampfireMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();
    const diffuse = texture(assetManager.resources.campfireDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(2);
    const normalRoughness = texture(
      assetManager.resources.campfireNormalRoughness,
      uv(),
    );
    this.normalNode = normalMap(normalRoughness.rgb);
    this.roughnessNode = normalRoughness.a;
  }
}

export class Campfire {
  constructor() {
    // Visual
    const campfire = assetManager.resources.worldModel.scene.getObjectByName(
      "campfire",
    ) as Mesh;
    campfire.material = new CampfireMaterial();

    const fire = new ParticleSystem({
      preset: "fire",
      count: 1024,
      height: 1.85,
      coneFactor: 1.25,
      speed: 0.5,
      radius: 0.85,
      bloom: 1.5,
      workGroupSize: 256,
    });
    fire.position.copy(campfire.position).setY(-0.15);

    sceneManager.scene.add(campfire, fire);

    // Physics
    const rigidBodyDesc = RigidBodyDesc.fixed()
      .setTranslation(...campfire.position.toArray())
      .setRotation(campfire.quaternion)
      .setUserData({ type: RevoColliderType.Stone });

    const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);
    campfire.geometry.computeBoundingSphere();
    const { radius } = campfire.geometry.boundingSphere!;
    const colliderDesc = ColliderDesc.ball(radius).setRestitution(0.75);
    physicsManager.world.createCollider(colliderDesc, rigidBody);
  }
}
