import {
  clamp,
  dot,
  fract,
  hash,
  instanceIndex,
  mix,
  normalGeometry,
  texture,
  uniform,
  uv,
  vec3,
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
    const noise = texture(
      assetManager.noiseTexture,
      fract(uv().add(rand).mul(5)),
    );
    const mixedNoise = mix(noise.b, noise.r, 0.15);
    const roughnessVariation = this._uniforms.uBaseColor.add(mixedNoise);

    const ambientOcclusion = clamp(
      dot(normalGeometry, vec3(0.0, 1.0, 0.0)),
      0.4,
      0.5,
    );
    const aoAdjusted = roughnessVariation.mul(ambientOcclusion);

    this.colorNode = aoAdjusted;
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
      const randomYaw = Math.random() * Math.PI * 2;
      colliderSphere.rotateY(randomYaw);
      colliderSphere.updateMatrix();
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

    this.debugMonument();
  }

  private debugMonument() {
    const monumentsFolder = debugManager.panel.addFolder({
      title: "🪨 Rocks",
    });
    monumentsFolder.expanded = false;
    monumentsFolder.addBinding(this.uniforms.uBaseColor, "value", {
      label: "Color",
      view: "color",
      color: { type: "float" },
    });
  }
}
