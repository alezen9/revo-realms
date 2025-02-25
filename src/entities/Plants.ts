import { BoxGeometry, Mesh, MeshBasicNodeMaterial } from "three/webgpu";
import { State } from "../Game";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export default class Plants {
  constructor(scene: State["scene"]) {
    const geom = mergeVertices(new BoxGeometry(3, 3, 3));
    const mat = new PlantMaterial();
    const plant = new Mesh(geom, mat);
    plant.position.y = 1.5;
    // scene.add(plant);
  }
}

class PlantMaterial extends MeshBasicNodeMaterial {
  constructor() {
    super();
    this.createMaterial();
  }

  private createMaterial() {
    this.wireframe = true;
  }
}
