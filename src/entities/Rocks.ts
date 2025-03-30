import {
  float,
  // Fn,
  fract,
  hash,
  instancedArray,
  instanceIndex,
  positionWorld,
  step,
  texture,
  uv,
  varying,
} from "three/tsl";
import {
  InstancedMesh,
  Mesh,
  MeshLambertNodeMaterial,
  NormalMapNode,
} from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physics } from "../systems/Physics";
import { sceneManager } from "../systems/SceneManager";
import { tslUtils } from "../systems/TSLUtils";
// import { rendererManager } from "../systems/RendererManager";
// import { eventsManager } from "../systems/EventsManager";

const COUNT = 20;

class RockMaterial extends MeshLambertNodeMaterial {
  private _noiseBuffer: ReturnType<typeof instancedArray>; // holds: float = (noise)

  constructor() {
    super();
    this._noiseBuffer = instancedArray(COUNT, "float");
    this._noiseBuffer.setPBO(true);

    // this.computeUpdate.onInit(({ renderer }) => {
    //   renderer.computeAsync(this.computeInit);
    // });

    // eventsManager.on("update", this.updateAsync.bind(this));

    this.precision = "lowp";
    this.flatShading = false;

    const mapUv = tslUtils.computeMapUvByPosition(positionWorld.xz);
    const vMapUv = varying(mapUv);

    const rand = hash(instanceIndex);
    const noiseValue = texture(assetManager.noiseTexture, vMapUv);
    const discriminantA = step(0.5, noiseValue.r);
    const discriminantB = float(1).sub(discriminantA);
    const basicUv = fract(uv().mul(3.6).add(rand));
    const mossyUv = fract(uv().mul(1.5).add(rand));

    // Diffuse

    const diffBasic = texture(assetManager.stoneDiffuse, basicUv).mul(
      discriminantA,
    );

    const diffMossy = texture(assetManager.stoneMossyDiffuse, mossyUv).mul(
      discriminantB,
    );
    const finalColor = diffBasic.add(diffMossy);
    this.colorNode = finalColor.rgb;

    // Normal
    const norAoBasic = texture(assetManager.stoneNormalAo, basicUv).mul(
      discriminantA,
    );
    const norMossyAo = texture(assetManager.stoneMossyNormalAo, mossyUv).mul(
      discriminantB,
    );
    const norAo = norAoBasic.add(norMossyAo);
    this.normalNode = new NormalMapNode(norAo.rgb, float(3));

    // AO
    this.aoNode = norAo.a;
  }

  // private computeInit = Fn(() => {})().compute(COUNT);

  // private computeUpdate = Fn(() => {})().compute(COUNT);

  // private async updateAsync() {
  //   await rendererManager.renderer.computeAsync(this.computeUpdate);
  // }
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
        .setRotation(colliderSphere.quaternion);
      const rigidBody = physics.world.createRigidBody(rigidBodyDesc);
      colliderSphere.geometry.computeBoundingBox();
      const radius =
        colliderSphere.geometry.boundingBox!.max.x * colliderSphere.scale.x;
      const colliderDesc = ColliderDesc.ball(radius).setRestitution(0.15);
      physics.world.createCollider(colliderDesc, rigidBody);
    });
    sceneManager.scene.add(instances);
  }
}
