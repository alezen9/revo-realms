import {
  float,
  fract,
  hash,
  instanceIndex,
  step,
  texture,
  uv,
} from "three/tsl";
import {
  InstancedMesh,
  Mesh,
  MeshLambertNodeMaterial,
  NormalMapNode,
} from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
// import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
// import { physics } from "../systems/Physics";
import { sceneManager } from "../systems/SceneManager";

class RockMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();

    this.precision = "lowp";
    this.flatShading = false;
    const rand = hash(instanceIndex);
    const discriminantA = step(0.5, rand);
    const discriminantB = float(1).sub(discriminantA);
    const basicUv = fract(uv().mul(3.6).add(rand));
    const mossyUv = fract(uv().mul(1.5).add(rand));

    // Diffuse

    const diffBasic = texture(assetManager.stoneDiffuse, basicUv).mul(
      discriminantA,
    );

    const diffMossy = texture(assetManager.stoneMossyDiffuse, mossyUv).mul(
      discriminantB,
    );
    const finalColor = diffBasic.add(diffMossy);
    this.colorNode = finalColor.rgb;

    // Normal
    const norAoBasic = texture(assetManager.stoneNormalAo, basicUv).mul(
      discriminantA,
    );
    const norMossyAo = texture(assetManager.stoneMossyNormalAo, mossyUv).mul(
      discriminantB,
    );
    const norAo = norAoBasic.add(norMossyAo);
    this.normalNode = new NormalMapNode(norAo.rgb, float(3));

    // AO
    this.aoNode = norAo.a;
  }
}

export default class Rocks {
  constructor() {
    // Visual
    const rock = assetManager.realmModel.scene.getObjectByName("stone") as Mesh;
    const colliders = assetManager.realmModel.scene.children.filter(
      ({ name }) => name.startsWith("stone_collider"),
    ) as Mesh[];

    const material = new RockMaterial();
    const instances = new InstancedMesh(
      rock.geometry,
      material,
      colliders.length,
    );

    instances.receiveShadow = true;

    // const baseCollider = assetManager.realmModel.scene.getObjectByName(
    //   "base_stone_collider",
    // ) as Mesh;
    // const boundingSphere = baseCollider.geometry.boundingSphere!;
    // const baseRadius = boundingSphere.radius;

    colliders.forEach((colliderSphere, i) => {
      instances.setMatrixAt(i, colliderSphere.matrix);
      // // Physics
      // const rigidBodyDesc = RigidBodyDesc.fixed()
      //   .setTranslation(...colliderSphere.position.toArray())
      //   .setRotation(colliderSphere.quaternion);
      // const rigidBody = physics.world.createRigidBody(rigidBodyDesc);
      // const radius = baseRadius * colliderSphere.scale.y;
      // const colliderDesc = ColliderDesc.ball(radius).setRestitution(0.15);
      // physics.world.createCollider(colliderDesc, rigidBody);
    });
    sceneManager.scene.add(instances);
  }
}
