import { State } from "../core/Engine";
import grassModelUrl from "/grass.glb?url";
import {
  BufferGeometry,
  Color,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Scene,
  Vector3,
} from "three";
import { DRACOLoader, GLTFLoader } from "three/examples/jsm/Addons.js";

export default class GrassV2 {
  private geometry?: BufferGeometry;
  private material?: MeshStandardMaterial;

  constructor(state: State) {
    const { scene } = state;
    this.loadGrassModel(scene);
  }

  private async loadGrassModel(scene: Scene) {
    // Draco loader
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("draco/");

    // GLTF loader
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    const model = await gltfLoader.loadAsync(grassModelUrl);
    const grass = model.scene.children[0] as Mesh;
    this.geometry = grass.geometry;
    this.material = grass.material as MeshStandardMaterial;
    this.material.color = new Color("#3f9b0b");

    const instances = this.createField();
    scene.add(instances);
  }

  private createField() {
    const gridSize = 1;
    const gridScale = 10;
    const areaSize = 10;

    const instances = new InstancedMesh(
      this.geometry,
      this.material,
      areaSize * areaSize,
    );
    instances.receiveShadow = true;
    instances.scale.set(
      gridSize * gridScale,
      0.5 * gridScale,
      gridSize * gridScale,
    );

    const dummyObject = new Object3D();

    let instanceIndex = 0;

    const step = areaSize / gridSize;

    const overlap = gridSize * 0.5;

    const halfAreaSize = areaSize / 2;

    // Scatter blades in a grid
    for (let rowIdx = 0; rowIdx < step; rowIdx++) {
      for (let colIdx = 0; colIdx < step; colIdx++) {
        dummyObject.position.set(
          -halfAreaSize + colIdx * gridSize - colIdx * overlap,
          0,
          -halfAreaSize + rowIdx * gridSize - colIdx * overlap,
        );
        // dummyObject.rotation.y = Math.random() * 0.1;

        dummyObject.updateMatrix();
        instances.setMatrixAt(instanceIndex++, dummyObject.matrix);
      }
    }

    // Ensure updates are applied to the instance matrix
    instances.instanceMatrix.needsUpdate = true;

    return instances;
  }

  update(state: State) {}
}
