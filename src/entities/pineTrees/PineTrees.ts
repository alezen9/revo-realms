import { Mesh } from "three";
import {
  assets,
  debugPanel,
  physicsWorld,
  stage,
  graphics,
} from "../../systems";
import { EqualDepth } from "three";
import { BatchedMesh, MeshBasicNodeMaterial } from "three/webgpu";
import { VSMReceiverLambertMaterial } from "../../systems/vsm/VSMReceiverMaterials";
import {
  attribute,
  float,
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

const getCanopyPosition = () => {
  const windWeight = attribute<"float">("_windweight");
  const random = uv().x.mul(uv().y).mul(4);
  const profile = windWeight.mul(windWeight);
  const t = gameTime.mul(uniforms.uCanopySwaySpeed).add(random);
  const swayOffset = oscSine(t).mul(profile).mul(0.1);
  return positionLocal.add(vec3(0, swayOffset, 0));
};

// alpha tested needles defeat hidden surface removal, so a cheap pass writes
// their depth first and the lit pass only shades what is left in front
class PineTreeCanopyDepthMaterial extends MeshBasicNodeMaterial {
  constructor() {
    super();
    this.forceSinglePass = true;
    this.colorWrite = false;
    this.opacityNode = texture(assets.resources.pineTreeDiffuse, uv()).a;
    this.alphaTest = 0.35;
    this.alphaToCoverage = true;
    this.positionNode = getCanopyPosition();
  }
}

// no alpha test here, the equal depth test keeps only the samples the depth pass kept
class PineTreeCanopyMaterial extends VSMReceiverLambertMaterial {
  constructor() {
    super();
    this.forceSinglePass = true;
    this.depthFunc = EqualDepth;
    this.depthWrite = false;
    // needles are too thin and noisy for the finest shadow pages, and close up
    // they scatter page requests across the whole pool
    this.softShadowNode = float(0.5);

    const diffuse = texture(assets.resources.pineTreeDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.uCanopyDiffuseScale);
    this.positionNode = getCanopyPosition();
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
    const pineTreeCanopy = assets.getMesh("pine_tree_canopy");
    const pineTreeBark = assets.getMesh("pine_tree_bark");

    const colliders = assets.resources.worldModel.scene.children.filter(
      (object): object is Mesh =>
        object instanceof Mesh && object.name.startsWith("pine_collider"),
    );

    const barkMaterial = new PineTreeBarkMaterial();
    const canopyDepthMaterial = new PineTreeCanopyDepthMaterial();
    const canopyMaterial = new PineTreeCanopyMaterial();

    const barkBatch = this.createBatchedMesh(
      colliders,
      pineTreeBark.geometry,
      barkMaterial,
    );
    const canopyDepthBatch = this.createBatchedMesh(
      colliders,
      pineTreeCanopy.geometry,
      canopyDepthMaterial,
    );
    const canopyBatch = this.createBatchedMesh(
      colliders,
      pineTreeCanopy.geometry,
      canopyMaterial,
    );
    // after the opaque scene, depth first so the lit pass can test against it
    canopyDepthBatch.renderOrder = 1;
    canopyBatch.renderOrder = 2;

    const baseCollider = colliders[0];
    const { boundingBox } = baseCollider.geometry;
    if (!boundingBox) throw new Error("Pine collider has no bounding box");
    const baseRadius = boundingBox.max.x;
    const baseHalfHeight = boundingBox.max.y / 2;

    for (const colliderCylinder of colliders) {
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

    stage.mainScene.add(barkBatch, canopyDepthBatch, canopyBatch);
    graphics.vsmPass.registerCaster(barkBatch);
    graphics.vsmPass.registerCaster(canopyDepthBatch, {
      opacityNode: texture(assets.resources.pineTreeDiffuse).a,
    });
    this.debug();
  }

  private createBatchedMesh(
    colliders: Mesh[],
    geometry: Mesh["geometry"],
    material:
      | PineTreeBarkMaterial
      | PineTreeCanopyDepthMaterial
      | PineTreeCanopyMaterial,
  ) {
    const vertexCount = geometry.getAttribute("position").count;
    let indexCount = vertexCount * 2;
    if (geometry.index) indexCount = geometry.index.count;
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
