import type { Mesh } from "three";
import {
  assetManager,
  debugManager,
  physicsManager,
  sceneManager,
} from "../../systems";
import { InstancedMesh, MeshLambertNodeMaterial } from "three/webgpu";
import {
  attribute,
  normalMap,
  oscSine,
  positionLocal,
  texture,
  time,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { RevoColliderType } from "../../types";

const uniforms = {
  uCanopyDiffuseScale: uniform(0.6),
  uCanopySwaySpeed: uniform(0.75),
  uBarkDiffuseScale: uniform(3.5),
  uBarkNormalScale: uniform(3),
  uBarkUvScale: uniform(3),
};

class PineTreeCanopyMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.forceSinglePass = true;

    const windWeight = attribute("_windweight");

    const diffuse = texture(assetManager.resources.pineTreeDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.uCanopyDiffuseScale);
    this.opacityNode = diffuse.a;
    this.alphaTest = 0.35;

    const random = uv().x.mul(uv().y).mul(4);
    const profile = windWeight.mul(windWeight);
    const t = time.mul(uniforms.uCanopySwaySpeed).add(random);
    const swayOffset = oscSine(t).mul(profile).mul(0.1);
    this.positionNode = positionLocal.add(vec3(0, swayOffset, 0));
  }
}

class PineTreeBarkMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    const _uv = uv().mul(uniforms.uBarkUvScale);
    const diffuse = texture(assetManager.resources.treeBarkDiffuse, _uv);
    this.colorNode = diffuse.rgb.mul(uniforms.uBarkDiffuseScale);
    this.opacityNode = diffuse.a;
    this.alphaTest = 0.35;

    const normal = texture(assetManager.resources.treeBarkNormal, _uv);
    this.normalNode = normalMap(normal, uniforms.uBarkNormalScale);
  }
}

export default class PineTree {
  constructor() {
    // Visual
    this.debug();
    const pineTreeCanopy =
      assetManager.resources.worldModel.scene.getObjectByName(
        "pine_tree_canopy",
      ) as Mesh;
    const pineTreeBark =
      assetManager.resources.worldModel.scene.getObjectByName(
        "pine_tree_bark",
      ) as Mesh;

    const colliders = assetManager.resources.worldModel.scene.children.filter(
      ({ name }) => name.startsWith("pine_collider"),
    ) as Mesh[];

    const barkMaterial = new PineTreeBarkMaterial();
    const barkInstances = new InstancedMesh(
      pineTreeBark.geometry,
      barkMaterial,
      colliders.length,
    );

    const canopyMaterial = new PineTreeCanopyMaterial();
    const canopyInstances = new InstancedMesh(
      pineTreeCanopy.geometry,
      canopyMaterial,
      colliders.length,
    );

    const baseCollider = colliders[0];
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

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🌲 Pine Tree",
      expanded: false,
    });
    const canopy = folder.addFolder({
      title: "Canopy",
    });
    canopy.addBinding(uniforms.uCanopyDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
    canopy.addBinding(uniforms.uCanopySwaySpeed, "value", {
      label: "Sway speed",
      min: 0,
    });

    const bark = folder.addFolder({
      title: "Bark",
    });

    bark.addBinding(uniforms.uBarkUvScale, "value", {
      label: "UV scale",
      min: 0,
    });
    bark.addBinding(uniforms.uBarkDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
    bark.addBinding(uniforms.uBarkNormalScale, "value", {
      label: "Normal scale",
      min: 0,
    });
  }
}
