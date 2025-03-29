import { fract, mix, texture, uv, vec2, vec3 } from "three/tsl";
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

class BarkMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;

    const _uv = fract(uv().mul(4.5));

    // Diffuse
    const { barkDiffuse } = assetManager.atlasesCoords.srgb_atlas;
    const diffAtlasUv = tslUtils.computeAtlasUv(
      vec2(...barkDiffuse.scale),
      vec2(...barkDiffuse.offset),
      _uv,
    );
    const diff = texture(assetManager.srgbAtlas, diffAtlasUv);

    this.colorNode = diff.mul(2);

    // Normal
    const { barkNormal } = assetManager.atlasesCoords.linear_atlas;
    const norAtlasUv = tslUtils.computeAtlasUv(
      vec2(...barkNormal.scale),
      vec2(...barkNormal.offset),
      _uv,
    );
    const nor = texture(assetManager.linearAtlas, norAtlasUv);
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

    // Diffuse
    const { canopyDiffuse } = assetManager.atlasesCoords.srgb_atlas;
    const diffAtlasUv = tslUtils.computeAtlasUv(
      vec2(...canopyDiffuse.scale),
      vec2(...canopyDiffuse.offset),
      uv(),
    );
    const diff = texture(assetManager.srgbAtlas, diffAtlasUv);
    const summerAmbiance = mix(
      vec3(0.384, 0.511, 0.011),
      vec3(0.268, 0.162, 0.009),
      0.5,
    );

    // const autumnAmbiance = mix(
    //   vec3(1, 0.254, 0.052),
    //   vec3(1, 0.135, 0.092),
    //   0.5,
    // );
    this.colorNode = mix(diff, summerAmbiance, 0.5);

    // Normal
    const { canopyNormal } = assetManager.atlasesCoords.linear_atlas;
    const norAtlasUv = tslUtils.computeAtlasUv(
      vec2(...canopyNormal.scale),
      vec2(...canopyNormal.offset),
      uv(),
    );
    const nor = texture(assetManager.linearAtlas, norAtlasUv);
    this.normalNode = new NormalMapNode(nor);

    this.alphaTest = 0.9;
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
        .setRotation(colliderCylinder.quaternion);

      const rigidBody = physics.world.createRigidBody(rigidBodyDesc);
      const radius = baseRadius * colliderCylinder.scale.x;
      const halfHeight = baseHalfHeight * colliderCylinder.scale.y;
      const colliderDesc = ColliderDesc.capsule(
        halfHeight,
        radius,
      ).setRestitution(0.15);
      physics.world.createCollider(colliderDesc, rigidBody);
    });
    sceneManager.scene.add(barkInstances, canopyInstances);
  }
}
