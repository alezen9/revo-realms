import type { Mesh } from "three";
import {
  assetManager,
  debugManager,
  physicsManager,
  sceneManager,
} from "../../systems";
import {
  BatchedMesh,
  InstancedMesh,
  MeshLambertNodeMaterial,
} from "three/webgpu";
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
  // canopyDiffuseScale: uniform(1.2),
  canopyDiffuseScale: uniform(0.6),
  // canopyNormalScale: uniform(0.35),
  // canopyAoScale: uniform(1),
  // canopyMetalnessScale: uniform(0.5),
  // canopyRoughnessScale: uniform(1.5),
  swaySpeed: uniform(0.75),
  barkDiffuseScale: uniform(4),
  barkNormalScale: uniform(2.5),
  barkUVScale: uniform(3),
};

class PineTreeCanopyMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.forceSinglePass = true;

    const windWeight = attribute("_windweight");

    const diffuse = texture(assetManager.resources.pineTreeDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.canopyDiffuseScale);
    this.opacityNode = diffuse.a;
    this.alphaTest = 0.35;

    const random = uv().x.mul(uv().y).mul(4);
    const profile = windWeight.mul(windWeight);
    const t = time.mul(uniforms.swaySpeed).add(random);
    const swayOffset = oscSine(t).mul(profile).mul(0.1);
    this.positionNode = positionLocal.add(vec3(0, swayOffset, 0));

    // const arm = texture(assetManager.resources.pineTreeARM, uv());
    // this.aoNode = arm.r.mul(uniforms.canopyAoScale);
    // this.roughnessNode = arm.g.mul(uniforms.canopyRoughnessScale);
    // this.metalnessNode = arm.b.mul(uniforms.canopyMetalnessScale);

    // const normal = texture(assetManager.resources.pineTreeNormal, uv());
    // this.normalNode = normalMap(normal, uniforms.canopyNormalScale);
  }
}

class PineTreeBarkMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    const _uv = uv().mul(uniforms.barkUVScale);
    const diffuse = texture(assetManager.resources.treeBarkDiffuse, _uv);
    this.colorNode = diffuse.rgb.mul(uniforms.barkDiffuseScale);
    this.opacityNode = diffuse.a;
    this.alphaTest = 0.35;

    const normal = texture(assetManager.resources.treeBarkNormal, _uv);
    this.normalNode = normalMap(normal, uniforms.barkNormalScale);
  }
}

export class PineTree {
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
    folder.addBinding(uniforms.canopyDiffuseScale, "value", {
      label: "Canopy Diffuse scale",
      min: 0,
    });
    folder.addBinding(uniforms.swaySpeed, "value", {
      label: "Canopy Sway speed",
      min: 0,
    });
    // folder.addBinding(uniforms.canopyNormalScale, "value", {
    //   label: "Canopy Normal scale",
    //   min: 0,
    // });
    // folder.addBinding(uniforms.canopyAoScale, "value", {
    //   label: "Canopy AO scale",
    //   min: 0,
    // });
    // folder.addBinding(uniforms.canopyMetalnessScale, "value", {
    //   label: "Canopy Metalness scale",
    //   min: 0,
    // });
    // folder.addBinding(uniforms.canopyRoughnessScale, "value", {
    //   label: "Canopy Roughness scale",
    //   min: 0,
    // });

    folder.addBinding(uniforms.barkDiffuseScale, "value", {
      label: "Bark Diffuse scale",
      min: 0,
    });
    folder.addBinding(uniforms.barkNormalScale, "value", {
      label: "Bark Normal scale",
      min: 0,
    });
    folder.addBinding(uniforms.barkUVScale, "value", {
      label: "Bark UV scale",
      min: 0,
    });
  }
}
