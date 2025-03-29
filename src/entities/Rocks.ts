import {
  float,
  fract,
  hash,
  instanceIndex,
  step,
  texture,
  uv,
  vec2,
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
import { tslUtils } from "../systems/TSLUtils";

class RockMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();

    this.precision = "lowp";
    this.flatShading = false;
    const rand = hash(instanceIndex);
    const discriminantA = step(0.5, rand);
    const discriminantB = float(1).sub(discriminantA);
    const _uvLichen = fract(uv().mul(3.6).add(rand));
    const _uvMossy = fract(uv().mul(1.5).add(rand));

    // Diffuse
    const { stoneDiffuse, stoneMossyDiffuse } =
      assetManager.atlasesCoords.srgb_atlas;
    const diffLichenAtlasUv = tslUtils.computeAtlasUv(
      vec2(...stoneDiffuse.scale),
      vec2(...stoneDiffuse.offset),
      _uvLichen,
    );
    const diffLichen = texture(assetManager.srgbAtlas, diffLichenAtlasUv).mul(
      discriminantA,
    );

    const diffMossyAtlasUv = tslUtils.computeAtlasUv(
      vec2(...stoneMossyDiffuse.scale),
      vec2(...stoneMossyDiffuse.offset),
      _uvMossy,
    );
    const diffMossy = texture(assetManager.srgbAtlas, diffMossyAtlasUv).mul(
      discriminantB,
    );
    const finalColor = diffLichen.add(diffMossy);
    this.colorNode = finalColor.rgb.mul(2);

    // Normal
    const { stoneNormalAo, stoneMossyNormalAo } =
      assetManager.atlasesCoords.linear_atlas;
    const norLichenAtlasUv = tslUtils.computeAtlasUv(
      vec2(...stoneNormalAo.scale),
      vec2(...stoneNormalAo.offset),
      _uvLichen,
    );
    const norLichenAo = texture(assetManager.linearAtlas, norLichenAtlasUv).mul(
      discriminantA,
    );
    const norMossyAtlasUv = tslUtils.computeAtlasUv(
      vec2(...stoneMossyNormalAo.scale),
      vec2(...stoneMossyNormalAo.offset),
      _uvMossy,
    );
    const norMossyAo = texture(assetManager.linearAtlas, norMossyAtlasUv).mul(
      discriminantB,
    );
    const norAo = norLichenAo.add(norMossyAo);
    this.normalNode = new NormalMapNode(norAo.rgb, float(0.25));

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
