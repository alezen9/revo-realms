import { assetManager, debugManager, systemState } from "../../systems";
import { Mesh } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physicsManager, sceneManager } from "../../systems";
import { RevoColliderType } from "../../types";
import { mix, normalMap, texture, uniform, uv, vec3 } from "three/tsl";

const uniforms = {
  diffuseScale: uniform(1.15),
  normalScale: uniform(1.5),
  metalnessScale: uniform(1),
  roughnessScale: uniform(1.5),
  uvScale: uniform(4.75),
};
class ConcreteMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();

    this.precision = "lowp";
    const arm = texture(assetManager.resources.gokuStatueARM, uv());

    const _uv = uv().mul(uniforms.uvScale);
    const diffuse = texture(assetManager.resources.concreteDiffuse, _uv);
    const color = mix(vec3(0), diffuse.rgb, arm.r);
    this.colorNode = color.mul(uniforms.diffuseScale);

    const normal = texture(assetManager.resources.concreteNormal, _uv);
    this.normalNode = normalMap(normal.rgb, uniforms.normalScale);

    this.metalnessNode = arm.b.mul(uniforms.metalnessScale);
    this.roughnessNode = arm.g.mul(uniforms.roughnessScale);
  }
}

export default class DragonBall {
  constructor() {
    this.debug();

    // Visual
    const gokuStatue = assetManager.resources.worldModel.scene.getObjectByName(
      "goku_statue",
    ) as Mesh;
    gokuStatue.material = new ConcreteMaterial();
    gokuStatue.receiveShadow = true;
    sceneManager.scene.add(gokuStatue);

    // Physics
    const collider = assetManager.resources.worldModel.scene.getObjectByName(
      "goku_statue_collider",
    ) as Mesh;
    const rigidBodyDesc = RigidBodyDesc.fixed()
      .setTranslation(...collider.position.toArray())
      .setRotation(collider.quaternion)
      .setUserData({ type: RevoColliderType.Stone });

    const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);
    const hx = 0.5 * collider.scale.x;
    const hy = 0.5 * collider.scale.y;
    const hz = 0.5 * collider.scale.z;
    const colliderDesc = ColliderDesc.cuboid(hx, hy, hz).setRestitution(0.75);
    physicsManager.world.createCollider(colliderDesc, rigidBody);

    // Landmark
    systemState.wind.registerTarget("Goku statue", gokuStatue.position, 20);
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🐉 Dragon Ball",
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
    folder.addBinding(uniforms.metalnessScale, "value", {
      label: "Metalness scale",
      min: 0,
    });
    folder.addBinding(uniforms.roughnessScale, "value", {
      label: "Roughness scale",
      min: 0,
    });
    folder.addBinding(uniforms.uvScale, "value", {
      label: "UV scale",
      min: 0,
    });
  }
}
