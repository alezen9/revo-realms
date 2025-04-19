import {
  float,
  Fn,
  fract,
  hash,
  instancedArray,
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
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physicsManager } from "../systems/PhysicsManager";
import { sceneManager } from "../systems/SceneManager";
import { rendererManager } from "../systems/RendererManager";
import { tslUtils } from "../systems/TSLUtils";
import { RevoColliderType } from "../types";

const COUNT = 20; // Hardcoded, rocks are placed in blender and are less than 20

class RockMaterial extends MeshLambertNodeMaterial {
  private _noiseBuffer: ReturnType<typeof instancedArray>; // holds: float = (noise)

  constructor() {
    super();
    this._noiseBuffer = instancedArray(COUNT, "float");
    this._noiseBuffer.setPBO(true);
    rendererManager.renderer.computeAsync(this.computeInit);

    this.precision = "lowp";
    this.flatShading = false;

    const rand = hash(instanceIndex);
    const noiseValue = this._noiseBuffer.element(instanceIndex);
    const discriminantA = step(0.5, noiseValue);
    const discriminantB = float(1).sub(discriminantA);

    const basicUv = fract(uv().mul(3.6).add(rand));
    const mossyUv = fract(uv().mul(1.5).add(rand));

    const _uv = basicUv.mul(discriminantA).add(mossyUv.mul(discriminantB));

    const {
      stoneDiffuse,
      stoneNormalAo,
      stoneMossyDiffuse,
      stoneMossyNormalAo,
    } = assetManager.atlasesCoords.stones;

    // Diffuse
    // Scale
    const stoneDiffScale = vec2(...stoneDiffuse.scale).mul(discriminantA);
    const stoneMossyDiffScale = vec2(...stoneMossyDiffuse.scale).mul(
      discriminantB,
    );
    const scaleDiffuse = stoneDiffScale.add(stoneMossyDiffScale);
    // Offset
    const stoneDiffOffset = vec2(...stoneDiffuse.offset).mul(discriminantA);
    const stoneMossyDiffOffset = vec2(...stoneMossyDiffuse.offset).mul(
      discriminantB,
    );
    const offsetDiffuse = stoneDiffOffset.add(stoneMossyDiffOffset);

    const _uvDiff = tslUtils.computeAtlasUv(scaleDiffuse, offsetDiffuse, _uv);
    this.colorNode = texture(assetManager.stoneAtlas, _uvDiff);

    // Normal
    // Scale
    const stoneNorScale = vec2(...stoneNormalAo.scale).mul(discriminantA);
    const stoneMossyNorScale = vec2(...stoneMossyNormalAo.scale).mul(
      discriminantB,
    );
    const scaleNormal = stoneNorScale.add(stoneMossyNorScale);
    // Offset
    const stoneNorOffset = vec2(...stoneNormalAo.offset).mul(discriminantA);
    const stoneMossyNorOffset = vec2(...stoneMossyNormalAo.offset).mul(
      discriminantB,
    );
    const offsetNormal = stoneNorOffset.add(stoneMossyNorOffset);

    const _uvNor = tslUtils.computeAtlasUv(scaleNormal, offsetNormal, _uv);
    const norAo = texture(assetManager.stoneAtlas, _uvNor);
    this.normalNode = new NormalMapNode(norAo.rgb, float(3));

    // AO
    this.aoNode = norAo.a;
  }

  private computeInit = Fn(() => {
    const data = this._noiseBuffer.element(instanceIndex);
    const _uv = vec2(
      hash(instanceIndex),
      hash(instanceIndex).mul(21.63),
    ).fract();
    const noise = texture(assetManager.noiseTexture, _uv);
    data.assign(noise.r);
  })().compute(COUNT);
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

    colliders.forEach((colliderSphere, i) => {
      instances.setMatrixAt(i, colliderSphere.matrix);
      // Physics
      const rigidBodyDesc = RigidBodyDesc.fixed()
        .setTranslation(...colliderSphere.position.toArray())
        .setRotation(colliderSphere.quaternion)
        .setUserData({ type: RevoColliderType.Stone });

      const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);
      colliderSphere.geometry.computeBoundingBox();
      const radius =
        colliderSphere.geometry.boundingBox!.max.x * colliderSphere.scale.x;
      const colliderDesc = ColliderDesc.ball(radius).setRestitution(0.75);
      physicsManager.world.createCollider(colliderDesc, rigidBody);
    });
    sceneManager.scene.add(instances);
  }
}
