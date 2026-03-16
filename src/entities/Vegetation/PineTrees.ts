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
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { ColliderDesc } from "@dimforge/rapier3d";
import { RevoColliderType } from "../../types";
import { gameTime } from "../../utils/GameTime";
import { realmConfig } from "../../realm/config";

const uniforms = {
  uCanopyDiffuseScale: uniform(0.6),
  uCanopySwaySpeed: uniform(0.75),
  uBarkDiffuseScale: uniform(3.5),
  uBarkNormalScale: uniform(3),
  uBarkUvScale: uniform(3),
};

const config = {
  chunkSize: realmConfig.MAP_SIZE / 4,
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
    const t = gameTime.mul(uniforms.uCanopySwaySpeed).add(random);
    const swayOffset = oscSine(t).mul(profile).mul(0.1);
    this.positionNode = positionLocal.add(vec3(0, swayOffset, 0));
  }
}

class PineTreeBarkMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.forceSinglePass = true;
    const _uv = uv().mul(uniforms.uBarkUvScale);
    const diffuse = texture(assetManager.resources.treeBarkDiffuse, _uv);
    this.colorNode = diffuse.rgb.mul(uniforms.uBarkDiffuseScale);
    this.opacityNode = diffuse.a;
    this.alphaTest = 0.35;

    const normal = texture(assetManager.resources.treeBarkNormal, _uv);
    this.normalNode = normalMap(normal, uniforms.uBarkNormalScale);
  }
}

export default class PineTrees {
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
    const canopyMaterial = new PineTreeCanopyMaterial();

    const chunkCountPerAxis = Math.max(
      1,
      Math.ceil(realmConfig.MAP_SIZE / config.chunkSize),
    );
    const chunkedColliders = new Map<string, Mesh[]>();

    colliders.forEach((collider) => {
      const chunkX = Math.min(
        chunkCountPerAxis - 1,
        Math.max(
          0,
          Math.floor(
            (collider.position.x + realmConfig.HALF_MAP_SIZE) /
              config.chunkSize,
          ),
        ),
      );
      const chunkZ = Math.min(
        chunkCountPerAxis - 1,
        Math.max(
          0,
          Math.floor(
            (collider.position.z + realmConfig.HALF_MAP_SIZE) /
              config.chunkSize,
          ),
        ),
      );
      const chunkKey = `${chunkX}:${chunkZ}`;
      let chunk = chunkedColliders.get(chunkKey);
      if (!chunk) {
        chunk = [];
        chunkedColliders.set(chunkKey, chunk);
      }
      chunk.push(collider);
    });

    const chunkMeshes = [...chunkedColliders.values()].flatMap((chunk) =>
      this.createChunkMeshes(
        chunk,
        pineTreeBark.geometry,
        pineTreeCanopy.geometry,
        barkMaterial,
        canopyMaterial,
      ),
    );

    const baseCollider = colliders[0];
    const boundingBox = baseCollider.geometry.boundingBox!;
    const baseRadius = boundingBox.max.x;
    const baseHalfHeight = boundingBox.max.y / 2;

    colliders.forEach((colliderCylinder) => {
      // Physics
      const radius = baseRadius * colliderCylinder.scale.x;
      const halfHeight = baseHalfHeight * colliderCylinder.scale.y;
      const colliderDesc = ColliderDesc.capsule(halfHeight, radius)
        .setTranslation(...colliderCylinder.position.toArray())
        .setRotation(colliderCylinder.quaternion)
        .setRestitution(0.75);
      physicsManager.world.createCollider(colliderDesc).userData = {
        type: RevoColliderType.Wood,
      };
    });

    if (chunkMeshes.length) sceneManager.scene.add(...chunkMeshes);
  }

  private createChunkMeshes(
    colliders: Mesh[],
    barkGeometry: Mesh["geometry"],
    canopyGeometry: Mesh["geometry"],
    barkMaterial: PineTreeBarkMaterial,
    canopyMaterial: PineTreeCanopyMaterial,
  ): InstancedMesh[] {
    if (!colliders.length) return [];

    const barkInstances = new InstancedMesh(
      barkGeometry,
      barkMaterial,
      colliders.length,
    );
    const canopyInstances = new InstancedMesh(
      canopyGeometry,
      canopyMaterial,
      colliders.length,
    );

    colliders.forEach((collider, i) => {
      barkInstances.setMatrixAt(i, collider.matrix);
      canopyInstances.setMatrixAt(i, collider.matrix);
    });

    barkInstances.instanceMatrix.needsUpdate = true;
    canopyInstances.instanceMatrix.needsUpdate = true;
    barkInstances.computeBoundingSphere();
    canopyInstances.computeBoundingSphere();

    return [barkInstances, canopyInstances];
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
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
