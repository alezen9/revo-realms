import { Color, DoubleSide, InstancedMesh, Matrix4, type Texture } from "three";
import {
  float,
  hash,
  instanceIndex,
  mix,
  texture,
  transformNormalToView,
  uniform,
  uv,
  varying,
  vec3,
} from "three/tsl";
import { assets, debugPanel, graphics, stage } from "../../systems";
import { VSMReceiverLambertMaterial } from "../../systems/vsm/VSMReceiverMaterials";

const uniforms = {
  uTint: uniform(new Color(0.33, 0.55, 0.3)),
  uVariantTint: uniform(new Color(0.5, 0.5, 0.22)),
  uBrightnessSpread: uniform(0.25),
  uDiffuseScale: uniform(3.5),
};

class LakePlantMaterial extends VSMReceiverLambertMaterial {
  constructor(diffuse: Texture, tintVariety: number) {
    super();
    this.side = DoubleSide;

    const tintRoll = varying(hash(instanceIndex)).mul(tintVariety);
    const brightnessRoll = varying(hash(instanceIndex.add(7919)))
      .mul(2)
      .sub(1)
      .mul(tintVariety);
    const tint = mix(uniforms.uTint, uniforms.uVariantTint, tintRoll);
    const brightness = float(1).add(
      brightnessRoll.mul(uniforms.uBrightnessSpread),
    );

    const plant = texture(diffuse, uv());
    this.colorNode = plant.rgb
      .mul(tint)
      .mul(brightness)
      .mul(uniforms.uDiffuseScale);
    this.opacityNode = plant.a;
    this.alphaTest = 0.4;
    this.normalNode = transformNormalToView(vec3(0, 1, 0));
  }
}

export class LakePlants {
  constructor() {
    const {
      reedsModel,
      reedsPlacements,
      reedsDiffuse,
      seaweedModel,
      seaweedPlacements,
      seaweedDiffuse,
    } = assets.resources;

    const kinds = [
      {
        name: "reeds",
        model: reedsModel,
        placements: reedsPlacements,
        diffuse: reedsDiffuse,
        tintVariety: 0,
      },
      {
        name: "seaweed",
        model: seaweedModel,
        placements: seaweedPlacements,
        diffuse: seaweedDiffuse,
        tintVariety: 1,
      },
    ];

    const matrix = new Matrix4();
    for (const { name, model, placements, diffuse, tintVariety } of kinds) {
      const { geometry } = assets.getMesh(name, model);
      const { buffer, byteOffset, byteLength } = placements;
      const matrices = new Float32Array(buffer, byteOffset, byteLength / 4);

      const mesh = new InstancedMesh(
        geometry,
        new LakePlantMaterial(diffuse, tintVariety),
        matrices.length / 16,
      );
      for (let index = 0; index < mesh.count; index++)
        mesh.setMatrixAt(index, matrix.fromArray(matrices, index * 16));
      mesh.name = name;
      stage.mainScene.add(mesh);
      graphics.vsmPass.registerCaster(mesh, {
        opacityNode: texture(diffuse).a,
      });
    }

    this.debug();
  }

  private debug() {
    const folder = debugPanel.panel.addFolder({
      title: "🌿 Lake plants",
      expanded: false,
    });
    folder.addBinding(uniforms.uTint, "value", {
      label: "Tint",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uVariantTint, "value", {
      label: "Seaweed variant tint",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uBrightnessSpread, "value", {
      label: "Seaweed brightness spread",
      min: 0,
      max: 0.6,
      step: 0.01,
    });
    folder.addBinding(uniforms.uDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
      max: 6,
    });
  }
}
