import {
  cos,
  float,
  fract,
  mix,
  positionLocal,
  positionWorld,
  sin,
  texture,
  time,
  uv,
  vec3,
  vec4,
  vertexIndex,
} from "three/tsl";
import {
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshLambertNodeMaterial,
  NormalMapNode,
  Vector2,
} from "three/webgpu";
import { assetManager } from "../../systems/AssetManager";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physicsManager } from "../../systems/PhysicsManager";
import { sceneManager } from "../../systems/SceneManager";
import { tslUtils } from "../../utils/TSLUtils";
import { RevoColliderType } from "../../types";

class BarkMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;

    const _uv = fract(uv().mul(7));

    // Diffuse
    const diff = texture(assetManager.barkDiffuse, _uv);
    this.colorNode = diff.mul(2.5);

    // Normal
    const nor = texture(assetManager.barkNormal, _uv);
    this.normalNode = new NormalMapNode(nor);
  }
}

class CanopyMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;
    this.transparent = true;
    this.side = DoubleSide;

    const worlUv = tslUtils.computeMapUvByPosition(positionWorld.xz);
    const noise = texture(assetManager.noiseTexture, worlUv);

    // Diffuse
    const diff = texture(assetManager.canopyDiffuse, uv());
    // const summerAmbiance = mix(
    //   vec3(0.384, 0.511, 0.011),
    //   vec3(0.268, 0.162, 0.009),
    //   0.5,
    // );

    // const autumnAmbiance2 = mix(
    //   vec3(1, 0.254, 0.052),
    //   vec3(1, 0.767, 0.004),
    //   0.5,
    // );

    const seasonalAmbience = mix(
      vec3(0.889, 0.095, 0),
      vec3(1, 0.162, 0.009),
      0.5,
    );
    this.colorNode = vec4(
      mix(diff.rgb.mul(1.25), seasonalAmbience, noise.b.mul(0.4)).rgb,
      diff.a,
    );

    // Normal
    const nor = texture(assetManager.canopyNormal, uv());
    this.normalNode = new NormalMapNode(nor, float(1.25));
    this.normalScale = new Vector2(1, -1);

    // Alpha
    this.alphaTest = 0.9;

    // Position
    const timer = time.mul(noise.r).add(vertexIndex).mul(7.5);
    const sway = sin(timer).mul(0.015);
    const flutter = cos(timer.mul(0.75)).mul(0.01);
    this.positionNode = positionLocal.add(vec3(0, flutter, sway));
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

      const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);
      const radius = baseRadius * colliderCylinder.scale.x;
      const halfHeight = baseHalfHeight * colliderCylinder.scale.y;
      const colliderDesc = ColliderDesc.capsule(
        halfHeight,
        radius,
      ).setRestitution(0.75);
      physicsManager.world.createCollider(colliderDesc, rigidBody);
    });
    sceneManager.scene.add(barkInstances, canopyInstances);
  }
}
