import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import type { State } from "../Game";
import { eventsManager, sceneManager, shadowManager } from "../systems";

export class DynamicShadowTestRig {
  private sphere: Mesh;
  private box: Mesh;
  private torus: Mesh;
  private elapsed = 0;

  constructor() {
    const root = new Group();
    this.sphere = new Mesh(
      new SphereGeometry(1.25, 32, 16),
      new MeshStandardNodeMaterial({ color: new Color(0.95, 0.24, 0.12) }),
    );
    this.box = new Mesh(
      new BoxGeometry(2, 2, 2),
      new MeshStandardNodeMaterial({ color: new Color(0.12, 0.48, 0.95) }),
    );
    this.torus = new Mesh(
      new TorusGeometry(1.5, 0.42, 16, 48),
      new MeshStandardNodeMaterial({ color: new Color(0.95, 0.68, 0.12) }),
    );

    root.add(this.sphere, this.box, this.torus);
    this.updateTransforms();
    sceneManager.mainScene.add(root);
    shadowManager.register(root, {
      cast: true,
      mobility: "dynamic",
      receive: true,
    });
    eventsManager.on("engine-render-update", this.onEngineUpdate);
  }

  private onEngineUpdate = ({ delta }: State) => {
    this.elapsed += delta;
    this.updateTransforms();
  };

  private updateTransforms() {
    const time = this.elapsed;
    this.sphere.position.set(
      144 + Math.sin(time * 0.8) * 3.5,
      3.5 + Math.sin(time * 1.4) * 1.5,
      76,
    );
    this.sphere.rotation.y = time;

    this.box.position.set(151, 3.5, 76 + Math.sin(time * 0.65) * 4);
    this.box.rotation.set(time * 0.7, time * 1.1, time * 0.45);

    this.torus.position.set(
      156 + Math.cos(time * 0.55) * 3,
      4.5 + Math.sin(time * 0.9),
      84 + Math.sin(time * 0.55) * 3,
    );
    this.torus.rotation.set(Math.PI * 0.5 + time * 0.4, time * 0.8, 0);
  }
}
