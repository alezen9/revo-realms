import { Mesh } from "three";
import {
  assets,
  debugPanel,
  physicsWorld,
  stage,
  graphics,
} from "../../systems";
import { BatchedMesh } from "three/webgpu";
import { VSMReceiverLambertMaterial } from "../../systems/vsm/VSMReceiverMaterials";
import {
  attribute,
  normalMap,
  oscSine,
  positionLocal,
  texture,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { ColliderDesc } from "@dimforge/rapier3d";
import { RevoColliderType } from "../../systems/physics/colliderTypes";
import { gameTime } from "../../systems/time/gameTime";

const uniforms = {
  uCanopyDiffuseScale: uniform(0.6),
  uCanopySwaySpeed: uniform(0.75),
  uBarkDiffuseScale: uniform(3.5),
  uBarkNormalScale: uniform(3),
  uBarkUvScale: uniform(3),
};

class PineTreeCanopyMaterial extends VSMReceiverLambertMaterial {
  constructor() {
    super();
    this.forceSinglePass = true;

    const windWeight = attribute<"float">("_windweight");

    const diffuse = texture(assets.resources.pineTreeDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.uCanopyDiffuseScale);
    this.opacityNode = diffuse.a;
    this.alphaTest = 0.35;
    this.alphaToCoverage = true;

    const random = uv().x.mul(uv().y).mul(4);
    const profile = windWeight.mul(windWeight);
    const t = gameTime.mul(uniforms.uCanopySwaySpeed).add(random);
    const swayOffset = oscSine(t).mul(profile).mul(0.1);
    this.positionNode = positionLocal.add(vec3(0, swayOffset, 0));
  }
}

class PineTreeBarkMaterial extends VSMReceiverLambertMaterial {
  constructor() {
    super();
    this.forceSinglePass = true;
    const _uv = uv().mul(uniforms.uBarkUvScale);
    const diffuse = texture(assets.resources.treeBarkDiffuse, _uv);
    this.colorNode = diffuse.rgb.mul(uniforms.uBarkDiffuseScale);

    const normal = texture(assets.resources.treeBarkNormal, _uv);
    this.normalNode = normalMap(normal, uniforms.uBarkNormalScale);
  }
}

export class PineTrees {
  constructor() {
    // Visual
    const pineTreeCanopy = assets.getMesh("pine_tree_canopy");
    const pineTreeBark = assets.getMesh("pine_tree_bark");

    const colliders = assets.resources.worldModel.scene.children.filter(
      (object): object is Mesh =>
        object instanceof Mesh && object.name.startsWith("pine_collider"),
    );

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
      physicsWorld.world.createCollider(colliderDesc).userData = {
        type: RevoColliderType.Wood,
      };
    }

    stage.mainScene.add(barkBatch, canopyBatch);
    graphics.vsmPass.registerCaster(barkBatch);
    graphics.vsmPass.registerCaster(canopyBatch, {
      opacityNode: texture(assets.resources.pineTreeDiffuse).a,
    });
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
    const folder = debugPanel.panel.addFolder({
      title: "🌲 Pine Trees",
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
