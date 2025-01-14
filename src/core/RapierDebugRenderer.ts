import { World } from "@dimforge/rapier3d-compat";
import {
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  Scene,
} from "three";

export default class RapierDebugRenderer {
  mesh;
  world;
  enabled = true;

  constructor(scene: Scene, world: World) {
    this.world = world;
    this.mesh = new LineSegments(
      new BufferGeometry(),
      new LineBasicMaterial({ color: 0xffffff, vertexColors: true }),
    );
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update() {
    if (this.enabled) {
      const { vertices, colors } = this.world.debugRender();
      this.mesh.geometry.setAttribute(
        "position",
        new BufferAttribute(vertices, 3),
      );
      this.mesh.geometry.setAttribute("color", new BufferAttribute(colors, 4));
      this.mesh.visible = true;
    } else {
      this.mesh.visible = false;
    }
  }
}
