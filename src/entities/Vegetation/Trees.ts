import {
  float,
  fract,
  hash,
  instanceIndex,
  mix,
  positionLocal,
  positionWorld,
  sin,
  texture,
  uniform,
  uv,
  vec3,
  vertexIndex,
} from "three/tsl";
import {
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshLambertNodeMaterial,
  NormalMapNode,
} from "three/webgpu";
import { assetManager } from "../../systems/AssetManager";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physics } from "../../systems/Physics";
import { sceneManager } from "../../systems/SceneManager";
import { tslUtils } from "../../systems/TSLUtils";
import { eventsManager } from "../../systems/EventsManager";
import { State } from "../../Game";
import { RevoColliderType } from "../../types";

class BarkMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;

    const _uv = fract(uv().mul(7));

    // Diffuse
    const diff = texture(assetManager.barkDiffuse, _uv);
    this.colorNode = diff;

    // Normal
    const nor = texture(assetManager.barkNormal, _uv);
    this.normalNode = new NormalMapNode(nor);
  }
}

class CanopyMaterial extends MeshLambertNodeMaterial {
  private uTime = uniform(0);
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;
    this.transparent = true;
    this.side = DoubleSide;

    const worlUv = tslUtils.computeMapUvByPosition(positionWorld.xz);
    const noise = texture(assetManager.noiseTexture, worlUv);
    const factor = hash(instanceIndex.add(noise.b));

    // Diffuse
    const diff = texture(assetManager.canopyDiffuse, uv());
    // const summerAmbiance = mix(
    //   vec3(0.384, 0.511, 0.011),
    //   vec3(0.268, 0.162, 0.009),
    //   0.5,
    // );

    const autumnAmbiance1 = mix(
      vec3(0.889, 0.095, 0),
      vec3(1, 0.162, 0.009),
      0.5,
    );

    const autumnAmbiance2 = mix(
      vec3(1, 0.254, 0.052),
      vec3(1, 0.767, 0.004),
      0.5,
    );
    const mixed = mix(autumnAmbiance1, autumnAmbiance2, factor);
    this.colorNode = mix(diff.mul(1.25), mixed, noise.b);

    // Normal
    const nor = texture(assetManager.canopyNormal, uv());
    this.normalNode = new NormalMapNode(nor, float(2));

    // Alpha
    this.alphaTest = 0.9;

    // Position
    const timer = this.uTime.mul(noise.r).add(vertexIndex).mul(7.5);
    const wavering = sin(timer).mul(0.015);
    this.positionNode = positionLocal.add(wavering);

    eventsManager.on("update", this.update.bind(this));
  }

  private update(state: State) {
    const { clock } = state;
    this.uTime.value = clock.elapsedTime;
  }
}
export default class Trees {
  constructor() {
    // Visual
    const tree = assetManager.realmModel.scene.getObjectByName("tree") as Group;
    const colliders = assetManager.realmModel.scene.children.filter(
      ({ name }) => name.startsWith("tree_collider"),
    ) as Mesh[];

    const barkMaterial = new BarkMaterial();
    const canopyMaterial = new CanopyMaterial();

    const [bark, canopy] = tree.children as Mesh[];

    const barkInstances = new InstancedMesh(
      bark.geometry,
      barkMaterial,
      colliders.length,
    );
    barkInstances.receiveShadow = true;

    const canopyInstances = new InstancedMesh(
      canopy.geometry,
      canopyMaterial,
      colliders.length,
    );

    const baseCollider = assetManager.realmModel.scene.getObjectByName(
      "base_tree_collider",
    ) as Mesh;
    const boundingBox = baseCollider.geometry.boundingBox!;
    const baseRadius = boundingBox.max.x;
    const baseHalfHeight = boundingBox.max.y / 2;

    colliders.forEach((colliderCylinder, i) => {
      barkInstances.setMatrixAt(i, colliderCylinder.matrix);
      canopyInstances.setMatrixAt(i, colliderCylinder.matrix);
      // Physics
      const rigidBodyDesc = RigidBodyDesc.fixed()
        .setTranslation(...colliderCylinder.position.toArray())
        .setRotation(colliderCylinder.quaternion)
        .setUserData({ type: RevoColliderType.Wood });

      const rigidBody = physics.world.createRigidBody(rigidBodyDesc);
      const radius = baseRadius * colliderCylinder.scale.x;
      const halfHeight = baseHalfHeight * colliderCylinder.scale.y;
      const colliderDesc = ColliderDesc.capsule(
        halfHeight,
        radius,
      ).setRestitution(0.75);
      physics.world.createCollider(colliderDesc, rigidBody);
    });
    sceneManager.scene.add(barkInstances, canopyInstances);
  }
}
