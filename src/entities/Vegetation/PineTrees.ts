import type { Mesh } from "three";
import {
  assetManager,
  debugManager,
  physicsManager,
  sceneManager,
} from "../../systems";
import { BatchedMesh, MeshLambertNodeMaterial } from "three/webgpu";
import { normalMap, texture, uniform, uv } from "three/tsl";
import { ColliderDesc } from "@dimforge/rapier3d";
import { RevoColliderType } from "../../types";
import {
  getPineCanopyPosition,
  PINE_CANOPY_ALPHA_TEST,
  pineCanopyUniforms,
} from "./PineTreeCanopy";

const uniforms = {
  uBarkDiffuseScale: uniform(3.5),
  uBarkNormalScale: uniform(3),
  uBarkUvScale: uniform(3),
};

class PineTreeCanopyMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.forceSinglePass = true;

    const diffuse = texture(assetManager.resources.pineTreeDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(pineCanopyUniforms.uDiffuseScale);
    this.opacityNode = diffuse.a;
    this.alphaTest = PINE_CANOPY_ALPHA_TEST;
    this.positionNode = getPineCanopyPosition();
  }
}

class PineTreeBarkMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.forceSinglePass = true;
    const _uv = uv().mul(uniforms.uBarkUvScale);
    const diffuse = texture(assetManager.resources.treeBarkDiffuse, _uv);
    this.colorNode = diffuse.rgb.mul(uniforms.uBarkDiffuseScale);

    const normal = texture(assetManager.resources.treeBarkNormal, _uv);
    this.normalNode = normalMap(normal, uniforms.uBarkNormalScale);
  }
}

export default class PineTrees {
  constructor() {
    // Visual
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
    const canopyMaterial = new PineTreeCanopyMaterial();

    const barkBatch = this.createBatchedMesh(
      colliders,
      pineTreeBark.geometry,
      barkMaterial,
    );
    const canopyBatch = this.createBatchedMesh(
      colliders,
      pineTreeCanopy.geometry,
      canopyMaterial,
    );
    canopyBatch.name = "pine_tree_canopy_batch";

    const baseCollider = colliders[0];
    const boundingBox = baseCollider.geometry.boundingBox!;
    const baseRadius = boundingBox.max.x;
    const baseHalfHeight = boundingBox.max.y / 2;

    for (const colliderCylinder of colliders) {
      // Physics
      const radius = baseRadius * colliderCylinder.scale.x;
      const halfHeight = baseHalfHeight * colliderCylinder.scale.y;
      const colliderDesc = ColliderDesc.capsule(halfHeight, radius)
        .setTranslation(...colliderCylinder.position.toArray())
        .setRotation(colliderCylinder.quaternion)
        .setRestitution(0.5);
      physicsManager.world.createCollider(colliderDesc).userData = {
        type: RevoColliderType.Wood,
      };
    }

    sceneManager.mainScene.add(barkBatch, canopyBatch);
    this.debug();
  }

  private createBatchedMesh(
    colliders: Mesh[],
    geometry: Mesh["geometry"],
    material: PineTreeBarkMaterial | PineTreeCanopyMaterial,
  ) {
    const vertexCount = geometry.getAttribute("position").count;
    const indexCount = geometry.index?.count ?? vertexCount * 2;
    const batch = new BatchedMesh(
      colliders.length,
      vertexCount,
      indexCount,
      material,
    );

    batch.perObjectFrustumCulled = true;
    batch.sortObjects = false;

    const geometryId = batch.addGeometry(geometry);

    for (const collider of colliders) {
      const instanceId = batch.addInstance(geometryId);
      batch.setMatrixAt(instanceId, collider.matrix);
    }

    batch.computeBoundingSphere();
    return batch;
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🌲 Pine Trees",
      expanded: false,
    });
    const canopy = folder.addFolder({
      title: "Canopy",
    });
    canopy.addBinding(pineCanopyUniforms.uDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
    canopy.addBinding(pineCanopyUniforms.uSwaySpeed, "value", {
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
