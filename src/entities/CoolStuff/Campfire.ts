import { InstancedMesh, Mesh, PlaneGeometry, Vector3 } from "three";
import { assetManager } from "../../systems/AssetManager";
import { sceneManager } from "../../systems/SceneManager";
import { MeshBasicNodeMaterial, SpriteNodeMaterial } from "three/webgpu";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { RevoColliderType } from "../../types";
import { physicsManager } from "../../systems/PhysicsManager";
import {
  cos,
  float,
  Fn,
  hash,
  instancedArray,
  instanceIndex,
  PI2,
  sin,
  texture,
  time,
  uv,
  vec4,
} from "three/tsl";
import { eventsManager } from "../../systems/EventsManager";
import { rendererManager } from "../../systems/RendererManager";

export default class Campfire {
  constructor() {
    // Visual
    const campfire = assetManager.realmModel.scene.getObjectByName(
      "campfire",
    ) as Mesh;
    campfire.material = new CampfireMaterial();

    sceneManager.scene.add(campfire);

    new FireParticleSystem(campfire.position);

    // Physics
    const rigidBodyDesc = RigidBodyDesc.fixed()
      .setTranslation(...campfire.position.toArray())
      .setRotation(campfire.quaternion)
      .setUserData({ type: RevoColliderType.Wood });

    const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);
    campfire.geometry.computeBoundingSphere();
    const { radius } = campfire.geometry.boundingSphere!;
    const colliderDesc = ColliderDesc.ball(radius).setRestitution(0.75);
    physicsManager.world.createCollider(colliderDesc, rigidBody);
  }
}

class CampfireMaterial extends MeshBasicNodeMaterial {
  constructor() {
    super();
    this.map = assetManager.campfireDiffuse;
  }
}

const COUNT = 256;
const LIFETIME = 1.25; // seconds
const MAX_HEIGHT = 2;
const WIGGLE_STRENGTH = 2;

class FireParticleSystem {
  constructor(position: Vector3) {
    const material = new FireParticlesMaterial();
    const fire = new InstancedMesh(new PlaneGeometry(), material, COUNT);
    fire.position.copy(position);
    sceneManager.scene.add(fire);
  }
}

class FireParticlesMaterial extends SpriteNodeMaterial {
  private _buffer1: ReturnType<typeof instancedArray>; // holds: vec4 = (x, y, z, alpha)

  constructor() {
    super();
    this._buffer1 = instancedArray(COUNT, "vec4");
    this._buffer1.setPBO(true);

    this.createMaterial();

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });

    eventsManager.on("update", () => {
      rendererManager.renderer.computeAsync(this.computeUpdate);
    });
  }

  private computeInit = Fn(() => {
    const data1 = this._buffer1.element(instanceIndex);

    const jitter = hash(instanceIndex.add(12345)).mul(0.2).sub(0.1);
    data1.assign(vec4(jitter, 0, jitter, 1));
  })().compute(COUNT);

  private computeUpdate = Fn(() => {
    const data1 = this._buffer1.element(instanceIndex);

    const randSeed = hash(instanceIndex);

    const t = time.mul(0.5).mod(LIFETIME);
    const offset = randSeed.mul(LIFETIME);
    const localTime = t.add(offset).mod(LIFETIME);

    const progress = localTime.div(LIFETIME);
    // start fast, slow down: y = 1 - (1 - progress)^2
    const verticalEase = float(1.0).sub(float(1.0).sub(progress).pow(2));
    const y = verticalEase.mul(MAX_HEIGHT);

    const randX = hash(instanceIndex.add(101));
    const randZ = hash(instanceIndex.add(202));

    const baseFrequency = float(2);
    const freqX = randX.mul(baseFrequency).add(baseFrequency);
    const freqZ = randZ.mul(baseFrequency).add(baseFrequency);

    const phaseX = progress.mul(freqX).add(randX.mul(PI2));
    const phaseZ = progress.mul(freqZ).add(randZ.mul(PI2));

    const x = sin(phaseX).mul(randX.mul(0.15).add(0.15)).mul(WIGGLE_STRENGTH);
    const z = cos(phaseZ).mul(randZ.mul(0.15).add(0.15)).mul(WIGGLE_STRENGTH);

    const fadeY = y.div(MAX_HEIGHT);
    const alpha = float(0.3).sub(fadeY.pow(3.0)).clamp();

    data1.assign(vec4(x, y, z, alpha));
  })().compute(COUNT);

  private createMaterial() {
    this.precision = "lowp";
    this.depthWrite = false;
    const data1 = this._buffer1.element(instanceIndex);
    const rand1 = hash(instanceIndex.add(9234));

    // Position
    this.positionNode = data1.xyz;

    // Size
    this.scaleNode = rand1.mul(data1.w).mul(7.5);

    // Opacity
    this.opacityNode = data1.w;

    // Color
    const diffuse = texture(assetManager.fireDiffuse, uv());
    this.colorNode = diffuse.mul(0.75);
  }
}
