import { fract, texture, uniform, uv } from "three/tsl";
import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshLambertNodeMaterial,
} from "three/webgpu";
import { UniformType } from "../../types";
import { assetManager } from "../../systems/AssetManager";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { debugManager } from "../../systems/DebugManager";
import { physics } from "../../systems/Physics";
import { sceneManager } from "../../systems/SceneManager";

type TreeMaterialUniforms = {
  uBaseColor: UniformType<Color>;
};

const uniforms: TreeMaterialUniforms = {
  uBaseColor: uniform(new Color()),
};

class BarkMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;
    const _uv = fract(uv());
    const diff = texture(assetManager.barkDiffTexture, _uv);
    this.colorNode = diff;
  }
}

class CanopyMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;
    this.transparent = true;
    this.depthTest = false;
    this.side = DoubleSide;
    this.normalMap = assetManager.canopyNorTexture;
    const diff = texture(assetManager.canopyDiffTexture, uv());
    this.colorNode = diff.mul(uniforms.uBaseColor);
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

    this.debugMonument();
  }

  private debugMonument() {
    const treesFolder = debugManager.panel.addFolder({
      title: "🌳 Trees",
    });
    treesFolder.expanded = false;
    treesFolder.addBinding(uniforms.uBaseColor, "value", {
      label: "Canopy color",
      view: "color",
      color: { type: "float" },
    });
  }
}
