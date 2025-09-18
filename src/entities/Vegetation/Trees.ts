import {
  cos,
  float,
  fract,
  mix,
  positionLocal,
  positionWorld,
  sin,
  step,
  texture,
  time,
  uniform,
  uv,
  vec3,
  vec4,
  vertexIndex,
} from "three/tsl";
import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshLambertNodeMaterial,
  NormalMapNode,
  Vector2,
} from "three/webgpu";
import { assetManager } from "../../systems/AssetManager";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physicsManager } from "../../systems/PhysicsManager";
import { sceneManager } from "../../systems/SceneManager";
import { tslUtils } from "../../utils/TSLUtils";
import { RevoColliderType } from "../../types";
import { debugManager } from "../../systems/DebugManager";

class BarkMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;

    const _uv = fract(uv().mul(7));

    // Diffuse
    const diff = texture(assetManager.barkDiffuse, _uv);
    this.colorNode = diff.mul(2.5);

    // Normal
    const nor = texture(assetManager.barkNormal, _uv);
    this.normalNode = new NormalMapNode(nor);
  }
}

const uniforms = {
  uPrimaryColor: uniform(new Color().setRGB(0.889, 0.095, 0)),
  uSecondaryColor: uniform(new Color().setRGB(1, 0.162, 0.009)),
  uMixFactor: uniform(0.5),
};

class CanopyMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;
    this.transparent = true;
    this.side = DoubleSide;

    const worlUv = tslUtils.computeMapUvByPosition(positionWorld.xz);
    const noise = texture(assetManager.noiseTexture, worlUv);

    // Diffuse
    const diff = texture(assetManager.canopyDiffuse, uv());

    const seasonalAmbience = mix(
      uniforms.uPrimaryColor,
      uniforms.uSecondaryColor,
      uniforms.uMixFactor,
    );

    this.colorNode = vec4(
      mix(diff.rgb, seasonalAmbience, noise.b.mul(0.4)).rgb,
      1,
    );

    // Normal
    const nor = texture(assetManager.canopyNormal, uv());
    this.normalNode = new NormalMapNode(nor, float(1.25));
    this.normalScale = new Vector2(1, -1);

    // Alpha
    this.opacityNode = step(0.5, diff.a);
    this.alphaTest = 0.1;

    // Position
    const timer = time.mul(noise.r).add(vertexIndex).mul(7.5);
    const sway = sin(timer).mul(0.015);
    const flutter = cos(timer.mul(0.75)).mul(0.01);
    this.positionNode = positionLocal.add(vec3(0, flutter, sway));
  }
}

export default class Trees {
  constructor() {
    // Visual
    const tree = assetManager.realmModel.scene.getObjectByName("tree") as Group;
    const colliders = assetManager.realmModel.scene.children.filter(
      ({ name }) => name.startsWith("tree_collider"),
    ) as Mesh[];

    const barkMaterial = new BarkMaterial();
    const canopyMaterial = new CanopyMaterial();

    const [bark, canopy] = tree.children as Mesh[];

    const barkInstances = new InstancedMesh(
      bark.geometry,
      barkMaterial,
      colliders.length,
    );
    barkInstances.receiveShadow = true;

    const canopyInstances = new InstancedMesh(
      canopy.geometry,
      canopyMaterial,
      colliders.length,
    );

    const baseCollider = assetManager.realmModel.scene.getObjectByName(
      "base_tree_collider",
    ) as Mesh;
    const boundingBox = baseCollider.geometry.boundingBox!;
    const baseRadius = boundingBox.max.x;
    const baseHalfHeight = boundingBox.max.y / 2;

    colliders.forEach((colliderCylinder, i) => {
      barkInstances.setMatrixAt(i, colliderCylinder.matrix);
      canopyInstances.setMatrixAt(i, colliderCylinder.matrix);
      // Physics
      const rigidBodyDesc = RigidBodyDesc.fixed()
        .setTranslation(...colliderCylinder.position.toArray())
        .setRotation(colliderCylinder.quaternion)
        .setUserData({ type: RevoColliderType.Wood });

      const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);
      const radius = baseRadius * colliderCylinder.scale.x;
      const halfHeight = baseHalfHeight * colliderCylinder.scale.y;
      const colliderDesc = ColliderDesc.capsule(
        halfHeight,
        radius,
      ).setRestitution(0.75);
      physicsManager.world.createCollider(colliderDesc, rigidBody);
    });
    sceneManager.scene.add(barkInstances, canopyInstances);

    this.debugTrees();
  }

  private debugTrees() {
    const folder = debugManager.panel.addFolder({ title: "🌳 Trees" });
    folder.expanded = false;
    folder.addBinding(uniforms.uPrimaryColor, "value", {
      label: "Primary Leaf Color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uSecondaryColor, "value", {
      label: "Seconary Leaf Color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uMixFactor, "value", {
      label: "Mix factor",
    });
  }
}
