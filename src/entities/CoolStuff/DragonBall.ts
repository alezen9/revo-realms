import { assetManager, debugManager, systemState } from "../../systems";
import { Mesh } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physicsManager, sceneManager } from "../../systems";
import { RevoColliderType } from "../../types";
import { mix, normalMap, texture, uniform, uv, vec3 } from "three/tsl";

const uniforms = {
  uDiffuseScale: uniform(1.15),
  uNormalScale: uniform(1.5),
  uMetalnessScale: uniform(1),
  uRoughnessScale: uniform(1.5),
  uUvScale: uniform(4.75),
};
class GokuStatueMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    const arm = texture(assetManager.resources.gokuStatueARM, uv());

    const _uv = uv().mul(uniforms.uUvScale);
    const diffuse = texture(assetManager.resources.concreteDiffuse, _uv);
    const color = mix(vec3(0), diffuse.rgb, arm.r);
    this.colorNode = color.mul(uniforms.uDiffuseScale);

    const normal = texture(assetManager.resources.concreteNormal, _uv);
    this.normalNode = normalMap(normal.rgb, uniforms.uNormalScale);

    this.metalnessNode = arm.b.mul(uniforms.uMetalnessScale);
    this.roughnessNode = arm.g.mul(uniforms.uRoughnessScale);
  }
}

export default class DragonBall {
  constructor() {
    this.debug();

    // Visual
    const gokuStatue = assetManager.resources.worldModel.scene.getObjectByName(
      "goku_statue",
    ) as Mesh;
    gokuStatue.material = new GokuStatueMaterial();
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
    folder.addBinding(uniforms.uUvScale, "value", {
      label: "UV scale",
      min: 0,
    });
    folder.addBinding(uniforms.uDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
    folder.addBinding(uniforms.uNormalScale, "value", {
      label: "Normal scale",
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
