import {
  Color,
  DoubleSide,
  InstancedMesh,
  Mesh,
  MeshLambertNodeMaterial,
} from "three/webgpu";
import { State } from "../Game";
import { assetManager } from "../systems/AssetManager";
import {
  Fn,
  fract,
  positionLocal,
  positionWorld,
  texture,
  uniform,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { UniformType } from "../types";
import { debugManager } from "../systems/DebugManager";

export default class Plants {
  private uniforms = {
    uTime: uniform(0),
    uPlantColor: uniform(new Color().setRGB(0.4, 0.7, 0.35)),
  };
  constructor(scene: State["scene"]) {
    const plant = assetManager.realmModel.scene.getObjectByName(
      "plant",
    ) as Mesh;
    plant.geometry.computeVertexNormals();
    plant.material = new PlantMaterial(this.uniforms);
    plant.position.set(0, 0, -30);

    const plantPlaceholders = assetManager.realmModel.scene.children.filter(
      (el) => el.name.startsWith("plant_placeholder"),
    ) as Mesh[];
    const instances = new InstancedMesh(
      plant.geometry,
      plant.material,
      plantPlaceholders.length,
    );
    for (let i = 0; i < plantPlaceholders.length; i++) {
      instances.setMatrixAt(i, plantPlaceholders[i].matrix);
    }
    scene.add(instances);

    this.debugPlants();
  }

  private debugPlants() {
    const plantsFolder = debugManager.panel.addFolder({ title: "🌿 Plants" });

    plantsFolder.addBinding(this.uniforms.uPlantColor, "value", {
      label: "Color",
      view: "color",
      color: { type: "float" },
    });
  }

  update(state: State) {
    const { clock } = state;
    this.uniforms.uTime.value = clock.getElapsedTime();
  }
}

type PlantUniforms = {
  uTime: UniformType<number>;
  uPlantColor: UniformType<Color>;
};

class PlantMaterial extends MeshLambertNodeMaterial {
  _uniforms: PlantUniforms;
  constructor(uniforms: PlantUniforms) {
    super();
    this._uniforms = { ...uniforms };
    this.createMaterial();
  }

  private computeDisplacement = Fn(() => {
    const strength = uv().y.mul(0.1);
    const noiseUv = fract(
      positionWorld.xz.add(this._uniforms.uTime.mul(0.075)),
    );
    const noise = texture(assetManager.perlinNoiseTexture, noiseUv, 3)
      .r.mul(1.5)
      .mul(strength);
    const newPosition = positionLocal.add(vec3(0, noise.negate(), 0));
    return newPosition;
  });

  private createMaterial() {
    this.transparent = true;
    this.side = DoubleSide;
    this.positionNode = this.computeDisplacement();
    const leafColor = texture(assetManager.leafTexture, uv());
    this.colorNode = leafColor.mul(vec4(this._uniforms.uPlantColor, 1));
    this.aoNode = vec3(0.5);
    this.alphaTest = 0.5;
  }
}
