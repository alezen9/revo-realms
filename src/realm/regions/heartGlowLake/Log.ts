import { type Mesh } from "three";
import { assetManager, debugManager, sceneManager } from "../../../systems";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { float, normalMap, texture, uniform, uv } from "three/tsl";

class LogMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();
    const diffuse = texture(assetManager.resources.logDiffuse, uv());
    this.colorNode = diffuse.mul(3);

    const normal = texture(assetManager.resources.logNormal, uv());
    this.normalNode = normalMap(normal, float(2));
  }
}

export class Log {
  constructor() {
    // Visual
    const log = assetManager.resources.worldModel.scene.getObjectByName(
      "log",
    ) as Mesh;
    log.material = new LogMaterial();
    sceneManager.scene.add(log);
  }
}
