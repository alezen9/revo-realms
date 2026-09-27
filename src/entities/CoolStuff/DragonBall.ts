import {
  assetManager,
  debugManager,
  landmarkManager,
  windManager,
  rendererManager,
} from "../../systems";
import { Mesh } from "three";
import { VSMReceiverStandardMaterial } from "../../systems/VSM/VSMReceiverMaterials";
import { ColliderDesc } from "@dimforge/rapier3d";
import { physicsManager, sceneManager } from "../../systems";
import { RevoColliderType } from "../../types";
import { normalMap, texture, uniform, uv } from "three/tsl";

const uniforms = {
  uDiffuseScale: uniform(1.15),
  uNormalScale: uniform(1.5),
  uUvScale: uniform(4.75),
};

class GokuStatueMaterial extends VSMReceiverStandardMaterial {
  constructor() {
    super();

    const _uv = uv().mul(uniforms.uUvScale);
    const diffuse = texture(assetManager.resources.concreteDiffuse, _uv);
    this.colorNode = diffuse.rgb.mul(uniforms.uDiffuseScale);

    const normal = texture(assetManager.resources.concreteNormal, _uv);
    this.normalNode = normalMap(normal.rgb, uniforms.uNormalScale);
  }
}

export default class DragonBall {
  private gokuStatue: Mesh;
  private shadowSettings = { depthBias: 0.2 };

  constructor() {
    // Visual
    const gokuStatue = assetManager.resources.worldModel.scene.getObjectByName(
      "goku_statue",
    ) as Mesh;
    this.gokuStatue = gokuStatue;
    gokuStatue.material = new GokuStatueMaterial();
    sceneManager.mainScene.add(gokuStatue);
    rendererManager.vsmPass.registerCaster(gokuStatue, this.shadowSettings);

    // Physics
    const collider = assetManager.resources.worldModel.scene.getObjectByName(
      "goku_statue_collider",
    ) as Mesh;
    const hx = 0.5 * collider.scale.x;
    const hy = 0.5 * collider.scale.y;
    const hz = 0.5 * collider.scale.z;
    const colliderDesc = ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(...collider.position.toArray())
      .setRotation(collider.quaternion)
      .setRestitution(0.4);
    physicsManager.world.createCollider(colliderDesc).userData = {
      type: RevoColliderType.Stone,
    };

    // Register landmark for radial menu discovery
    const landmarkId = landmarkManager.register({
      name: "Goku Statue",
      icon: "dragonball",
      position: gokuStatue.position,
      discoveryRadius: 80,
      arrivalRadius: 20,
    });

    // Register wind target and link to landmark
    const windTargetId = windManager.registerTarget(
      "Goku statue",
      gokuStatue.position,
      20,
    );
    landmarkManager.setWindTargetId(landmarkId, windTargetId);
    this.debug();
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🐉 Dragon Ball",
      expanded: false,
    });
    folder.addBinding(uniforms.uUvScale, "value", {
      label: "UV scale",
      min: 0,
    });
    folder.addBinding(uniforms.uDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
    folder.addBinding(uniforms.uNormalScale, "value", {
      label: "Normal scale",
      min: 0,
    });
    folder
      .addBinding(this.shadowSettings, "depthBias", {
        label: "Shadow bias (m)",
        min: 0,
        max: 0.5,
        step: 0.005,
      })
      .on("change", ({ value }) => {
        rendererManager.vsmPass.setCasterDepthBias(this.gokuStatue, value);
      });
  }
}
