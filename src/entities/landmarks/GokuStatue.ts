import { assets, debugPanel, landmarks, graphics } from "../../systems";
import { Mesh } from "three";
import { VSMReceiverStandardMaterial } from "../../systems/vsm/VSMReceiverMaterials";
import { ColliderDesc } from "@dimforge/rapier3d";
import { physicsWorld, stage } from "../../systems";
import { RevoColliderType } from "../../systems/physics/colliderTypes";
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
    const diffuse = texture(assets.resources.concreteDiffuse, _uv);
    this.colorNode = diffuse.rgb.mul(uniforms.uDiffuseScale);

    const normal = texture(assets.resources.concreteNormal, _uv);
    this.normalNode = normalMap(normal.rgb, uniforms.uNormalScale);
  }
}

export default class GokuStatue {
  private gokuStatue: Mesh;
  private shadowSettings = { depthBias: 0.2 };

  constructor() {
    // Visual
    const gokuStatue = assets.getMesh("goku_statue");
    this.gokuStatue = gokuStatue;
    gokuStatue.material = new GokuStatueMaterial();
    stage.mainScene.add(gokuStatue);
    graphics.vsmPass.registerCaster(gokuStatue, this.shadowSettings);

    // Physics
    const collider = assets.getMesh("goku_statue_collider");
    const hx = 0.5 * collider.scale.x;
    const hy = 0.5 * collider.scale.y;
    const hz = 0.5 * collider.scale.z;
    const colliderDesc = ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(...collider.position.toArray())
      .setRotation(collider.quaternion)
      .setRestitution(0.4);
    physicsWorld.world.createCollider(colliderDesc).userData = {
      type: RevoColliderType.Stone,
    };

    landmarks.register({
      name: "Goku Statue",
      icon: "dragonball",
      position: gokuStatue.position,
      arrivalRadius: 20,
    });
    this.debug();
  }

  private debug() {
    const folder = debugPanel.panel.addFolder({
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
        graphics.vsmPass.setCasterDepthBias(this.gokuStatue, value);
      });
  }
}
