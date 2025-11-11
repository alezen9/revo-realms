import { float, fract, texture, uniform, uv, vec2 } from "three/tsl";
import {
  Color,
  MathUtils,
  Mesh,
  MeshLambertNodeMaterial,
  NormalMapNode,
} from "three/webgpu";
import { RevoColliderType, type UniformType } from "../types";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { TSLUtils } from "../utils/TSLUtils";
import {
  assetManager,
  debugManager,
  physicsManager,
  sceneManager,
} from "../systems";

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

    const _uv = fract(uv().mul(2).add(this._uniforms.uRandom));

    const { stoneDiffuse, stoneNormalAo } = assetManager.atlasesCoords.stones;

    // Diffuse
    const _uvDiff = TSLUtils.computeAtlasUv(
      vec2(...stoneDiffuse.scale),
      vec2(...stoneDiffuse.offset),
      _uv,
    );
    const diff = texture(assetManager.resources.stoneAtlas, _uvDiff);
    this.colorNode = diff.mul(1.5);

    // Normal
    const _uvNor = TSLUtils.computeAtlasUv(
      vec2(...stoneNormalAo.scale),
      vec2(...stoneNormalAo.offset),
      _uv,
    );
    const norAo = texture(assetManager.resources.stoneAtlas, _uvNor);
    this.normalNode = new NormalMapNode(norAo.rgb, float(0.5));

    // AO
    this.aoNode = norAo.a;
  }
}

export default class Monuments {
  private uniforms = defaultUniforms;

  constructor() {
    // Visual
    const material = new StoneMaterial(this.uniforms);
    const monuments = assetManager.resources.realmModel.scene.children.filter(
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
    const colliders = assetManager.resources.realmModel.scene.children.filter(
      ({ name }) => name.startsWith("monument_collider"),
    ) as Mesh[];
    colliders.forEach((colliderBox) => {
      const rigidBodyDesc = RigidBodyDesc.fixed()
        .setTranslation(...colliderBox.position.toArray())
        .setRotation(colliderBox.quaternion)
        .setUserData({ type: RevoColliderType.Stone });

      const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);
      const hx = 0.5 * colliderBox.scale.x;
      const hy = 0.5 * colliderBox.scale.y;
      const hz = 0.5 * colliderBox.scale.z;
      const colliderDesc = ColliderDesc.cuboid(hx, hy, hz).setRestitution(0.75);
      physicsManager.world.createCollider(colliderDesc, rigidBody);
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
