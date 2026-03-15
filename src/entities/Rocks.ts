import {
  float,
  Fn,
  fract,
  hash,
  instancedArray,
  instanceIndex,
  normalMap,
  step,
  texture,
  uniform,
  uv,
  vec2,
} from "three/tsl";
import {
  InstancedMesh,
  Mesh,
  MeshLambertNodeMaterial,
  MeshStandardMaterial,
  MeshStandardNodeMaterial,
  NormalMapNode,
  Vector2,
} from "three/webgpu";
import { ColliderDesc } from "@dimforge/rapier3d";
import { debugManager, physicsManager, sceneManager } from "../systems";
import { TSLUtils } from "../utils/TSLUtils";
import { RevoColliderType } from "../types";
import { assetManager, rendererManager } from "../systems";

const COUNT = 20; // Hardcoded, rocks are placed in blender and are less than 20

class RockMaterial extends MeshLambertNodeMaterial {
  private _noiseBuffer = instancedArray(COUNT, "float"); // holds: float = (noise)

  constructor() {
    super();
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

    const _uvDiff = TSLUtils.computeAtlasUv(scaleDiffuse, offsetDiffuse, _uv);
    this.colorNode = texture(assetManager.resources.stoneAtlas, _uvDiff);

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

    const _uvNor = TSLUtils.computeAtlasUv(scaleNormal, offsetNormal, _uv);
    const norAo = texture(assetManager.resources.stoneAtlas, _uvNor);
    this.normalNode = new NormalMapNode(norAo.rgb, float(3));
    this.normalScale = new Vector2(1, -1);

    // AO
    this.aoNode = norAo.a;
  }

  private computeInit = Fn(() => {
    const data = this._noiseBuffer.element(instanceIndex);
    const _uv = vec2(
      hash(instanceIndex),
      hash(instanceIndex).mul(21.63),
    ).fract();
    const noise = texture(assetManager.resources.noiseAtlas, _uv);
    data.assign(noise.r);
  })().compute(COUNT);
}

const d = uniform(1.8);
const n = uniform(1.3);

class RockMaterial2 extends MeshStandardNodeMaterial {
  constructor() {
    super();

    debugManager.panel.addBinding(d, "value");
    debugManager.panel.addBinding(n, "value");

    const diffuse = texture(assetManager.resources.rocksDiffuse);
    this.colorNode = diffuse.rgb.mul(d);
    const normal = texture(assetManager.resources.rocksNormal);
    this.normalNode = normalMap(normal.rgb, n);
  }
}

export default class Rocks {
  constructor() {
    // Visual
    const rock = assetManager.resources.realmModel.scene.getObjectByName(
      "stone",
    ) as Mesh;
    const colliders = assetManager.resources.realmModel.scene.children.filter(
      ({ name }) => name.startsWith("stone_collider"),
    ) as Mesh[];

    const newRocks = assetManager.resources.worldModel.scene.children.filter(
      ({ name }) => name.startsWith("rock_common"),
    ) as Mesh[];

    const rocksMaterial = new RockMaterial2();

    newRocks.forEach((newRock) => (newRock.material = rocksMaterial));

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
      if (!colliderSphere.geometry.boundingBox) {
        colliderSphere.geometry.computeBoundingBox();
      }
      const { min, max } = colliderSphere.geometry.boundingBox!;
      const radius = 0.5 * (max.x - min.x) * Math.abs(colliderSphere.scale.x);
      const colliderDesc = ColliderDesc.ball(radius)
        .setTranslation(...colliderSphere.position.toArray())
        .setRotation(colliderSphere.quaternion)
        .setRestitution(0.75);
      physicsManager.world.createCollider(colliderDesc).userData = {
        type: RevoColliderType.Stone,
      };
    });
    sceneManager.scene.add(instances, ...newRocks);
  }
}
