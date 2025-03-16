import {
  clamp,
  dot,
  fract,
  normalGeometry,
  texture,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { Color, Mesh, MeshLambertNodeMaterial } from "three/webgpu";
import { UniformType } from "../types";
import { assetManager } from "../systems/AssetManager";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { debugManager } from "../systems/DebugManager";
import { physics } from "../systems/Physics";
import { sceneManager } from "../systems/SceneManager";

type StoneMaterialUniforms = {
  uBaseColor: UniformType<Color>;
};

const defaultUniforms: StoneMaterialUniforms = {
  uBaseColor: uniform(new Color("#8c8c8c")),
};

class StoneMaterial extends MeshLambertNodeMaterial {
  _uniforms: StoneMaterialUniforms;
  constructor(uniforms?: StoneMaterialUniforms) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };
    this.createMaterial();
  }

  private createMaterial() {
    this.flatShading = false;

    const fineNoise = texture(
      assetManager.noiseTexture,
      fract(uv().mul(1.5)),
    ).mul(0.1);
    const coarseNoise = texture(assetManager.noiseTexture, uv().mul(0.5)).mul(
      0.05,
    );
    const combinedNoise = fineNoise.add(coarseNoise);

    const roughnessVariation = this._uniforms.uBaseColor.add(combinedNoise.b);

    const ambientOcclusion = clamp(
      dot(normalGeometry, vec3(0.0, 1.0, 0.0)),
      0.3,
      1.0,
    );
    const aoAdjusted = roughnessVariation.mul(ambientOcclusion);

    this.colorNode = aoAdjusted;
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
    monuments.forEach((monument) => {
      monument.material = material;
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
      const colliderDesc = ColliderDesc.cuboid(hx, hy, hz).setRestitution(0.2);
      physics.world.createCollider(colliderDesc, rigidBody);
    });

    this.debugMonument();
  }

  private debugMonument() {
    const monumentsFolder = debugManager.panel.addFolder({
      title: "🗽 Monuments",
    });
    monumentsFolder.expanded = false;
    monumentsFolder.addBinding(this.uniforms.uBaseColor, "value", {
      label: "Color",
      view: "color",
      color: { type: "float" },
    });
  }
}
