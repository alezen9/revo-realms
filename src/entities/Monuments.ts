import { fract, texture, uniform, uv } from "three/tsl";
import { Color, MathUtils, Mesh, MeshLambertNodeMaterial } from "three/webgpu";
import { UniformType } from "../types";
import { assetManager } from "../systems/AssetManager";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physics } from "../systems/Physics";
import { sceneManager } from "../systems/SceneManager";
import { debugManager } from "../systems/DebugManager";

type StoneMaterialUniforms = {
  uBaseColor: UniformType<Color>;
  uRandom: UniformType<number>;
};

const defaultUniforms: StoneMaterialUniforms = {
  uBaseColor: uniform(new Color()),
  uRandom: uniform(0),
};

class StoneMaterial extends MeshLambertNodeMaterial {
  _uniforms: StoneMaterialUniforms;
  constructor(uniforms?: StoneMaterialUniforms) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };
    this.createMaterial();
  }

  setRandomSeed(n: number) {
    this._uniforms.uRandom.value = n;
  }

  private createMaterial() {
    this.precision = "lowp";
    this.flatShading = false;

    const _uv = fract(uv().add(this._uniforms.uRandom).mul(5));
    const diff = texture(assetManager.stoneDiffTexture, _uv);
    this.colorNode = diff.mul(this._uniforms.uBaseColor);
  }
}

export default class Monuments {
  private uniforms = defaultUniforms;

  constructor() {
    // Visual
    const material = new StoneMaterial(this.uniforms);
    const monuments = assetManager.realmModel.scene.children.filter(
      ({ name }) => name.endsWith("_monument"),
    ) as Mesh[];
    monuments.forEach((monument, idx) => {
      const rand = MathUtils.seededRandom(idx);
      monument.material = material;
      monument.receiveShadow = true;
      monument.onBeforeRender = (_, __, ___, ____, m: StoneMaterial) => {
        m.setRandomSeed(rand);
      };
    });
    sceneManager.scene.add(...monuments);

    // Physics
    const colliders = assetManager.realmModel.scene.children.filter(
      ({ name }) => name.startsWith("monument_collider"),
    ) as Mesh[];
    colliders.forEach((colliderBox) => {
      const rigidBodyDesc = RigidBodyDesc.fixed()
        .setTranslation(...colliderBox.position.toArray())
        .setRotation(colliderBox.quaternion);
      const rigidBody = physics.world.createRigidBody(rigidBodyDesc);
      const hx = 0.5 * colliderBox.scale.x;
      const hy = 0.5 * colliderBox.scale.y;
      const hz = 0.5 * colliderBox.scale.z;
      const colliderDesc = ColliderDesc.cuboid(hx, hy, hz).setRestitution(0.25);
      physics.world.createCollider(colliderDesc, rigidBody);
    });

    this.debugMonuments();
  }

  private debugMonuments() {
    const terrainFolder = debugManager.panel.addFolder({
      title: "🗽 Monuments",
    });
    terrainFolder.expanded = false;
    terrainFolder.addBinding(this.uniforms.uBaseColor, "value", {
      label: "Base color",
      view: "color",
      color: { type: "float" },
    });
  }
}
