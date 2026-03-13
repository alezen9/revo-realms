import { Mesh } from "three";
import { RevoColliderType } from "../types";
import ParticleSystem from "../utils/ParticleSystem";
import {
  assetManager,
  sceneManager,
  physicsManager,
  landmarkManager,
  windManager,
} from "../systems";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { normalMap, texture, uv } from "three/tsl";
import { Utils } from "../utils/Utils";

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
    const fireColliderMesh =
      assetManager.resources.worldModel.scene.getObjectByName(
        "fire_collider",
      ) as Mesh;
    const fireCollider = Utils.createBallCollider(fireColliderMesh);
    fireCollider.rigidBodyDesc.setUserData({ type: RevoColliderType.Stone });
    fireCollider.colliderDesc.setRestitution(0.75);
    const fireRigidBody = physicsManager.world.createRigidBody(
      fireCollider.rigidBodyDesc,
    );
    physicsManager.world.createCollider(
      fireCollider.colliderDesc,
      fireRigidBody,
    );

    const shortLogColliderMesh =
      assetManager.resources.worldModel.scene.getObjectByName(
        "log_short_collider",
      ) as Mesh;
    const shortLogCollider = Utils.createCylinderCollider(shortLogColliderMesh);
    shortLogCollider.rigidBodyDesc.setUserData({
      type: RevoColliderType.Wood,
    });
    shortLogCollider.colliderDesc.setRestitution(0.75);
    const shortLogRigidBody = physicsManager.world.createRigidBody(
      shortLogCollider.rigidBodyDesc,
    );
    physicsManager.world.createCollider(
      shortLogCollider.colliderDesc,
      shortLogRigidBody,
    );

    const longLogColliderMesh =
      assetManager.resources.worldModel.scene.getObjectByName(
        "log_long_collider",
      ) as Mesh;
    const longLogCollider = Utils.createCylinderCollider(longLogColliderMesh);
    longLogCollider.rigidBodyDesc.setUserData({
      type: RevoColliderType.Wood,
    });
    longLogCollider.colliderDesc.setRestitution(0.75);
    const longLogRigidBody = physicsManager.world.createRigidBody(
      longLogCollider.rigidBodyDesc,
    );
    physicsManager.world.createCollider(
      longLogCollider.colliderDesc,
      longLogRigidBody,
    );

    // Register landmark for radial menu discovery
    const landmarkId = landmarkManager.register({
      name: "Campfire",
      icon: "fire",
      position: campfire.position,
      discoveryRadius: 100,
      arrivalRadius: 15,
    });

    // Register wind target and link to landmark
    const windTargetId = windManager.registerTarget(
      "Campfire",
      campfire.position,
      15,
    );
    landmarkManager.setWindTargetId(landmarkId, windTargetId);
  }
}
