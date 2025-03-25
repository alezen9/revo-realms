import {
  fract,
  hash,
  instanceIndex,
  mix,
  texture,
  uniform,
  uv,
} from "three/tsl";
import {
  Color,
  InstancedMesh,
  Mesh,
  MeshLambertNodeMaterial,
} from "three/webgpu";
import { UniformType } from "../types";
import { assetManager } from "../systems/AssetManager";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { debugManager } from "../systems/DebugManager";
import { physics } from "../systems/Physics";
import { sceneManager } from "../systems/SceneManager";

type RockMaterialUniforms = {
  uBaseColor: UniformType<Color>;
};

const defaultUniforms: RockMaterialUniforms = {
  uBaseColor: uniform(new Color().setRGB(0.57, 0.57, 0.57)),
};

class RockMaterial extends MeshLambertNodeMaterial {
  _uniforms: RockMaterialUniforms;

  constructor(uniforms?: RockMaterialUniforms) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };
    this.createMaterial();
  }

  private createMaterial() {
    this.precision = "lowp";
    this.flatShading = false;
    const rand = hash(instanceIndex);
    const _uv = fract(uv().add(rand).mul(2.5));
    const noise = texture(assetManager.noiseTexture, _uv);
    const mixedNoise = noise.b.mul(noise.r);
    const diff = texture(assetManager.stoneDiffTexture, _uv);
    this.colorNode = mix(diff, this._uniforms.uBaseColor, mixedNoise);
  }
}

export default class Rocks {
  private uniforms = defaultUniforms;

  constructor() {
    // Visual
    const rock = assetManager.realmModel.scene.getObjectByName("rock") as Mesh;
    const colliders = assetManager.realmModel.scene.children.filter(
      ({ name }) => name.startsWith("rock_collider"),
    ) as Mesh[];

    const material = new RockMaterial(this.uniforms);
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
      const radius = 0.5 * colliderSphere.scale.y;
      const colliderDesc = ColliderDesc.ball(radius).setRestitution(0.15);
      physics.world.createCollider(colliderDesc, rigidBody);
    });
    sceneManager.scene.add(instances);

    this.debugRocks();
  }

  private debugRocks() {
    const rocksFolder = debugManager.panel.addFolder({
      title: "🪨 Rocks",
    });
    rocksFolder.expanded = false;
    rocksFolder.addBinding(this.uniforms.uBaseColor, "value", {
      label: "Base color",
      view: "color",
      color: { type: "float" },
    });
  }
}
