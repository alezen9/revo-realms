import { InstancedMesh, PlaneGeometry } from "three/webgpu";
import { eventBus, frustumCulling, graphics } from "../../../systems";
import { config } from "./campfireFireConfig";
import { CampfireFireCompute } from "./CampfireFireCompute";
import { CampfireFireMaterial } from "./CampfireFireMaterial";

const { COUNT } = config;

export class CampfireFire extends InstancedMesh {
  private compute = new CampfireFireCompute();
  private isOnScreen = false;

  constructor() {
    super(new PlaneGeometry(), undefined, COUNT);
    this.material = new CampfireFireMaterial(this.compute);

    eventBus.on("engine-render-update-throttle-64x", this.onVisibilityCheck);
    eventBus.on("engine-render-update-throttle-2x", this.onComputeUpdate);
  }

  private onVisibilityCheck = () => {
    this.isOnScreen = frustumCulling.isMeshVisible(this);
  };

  private onComputeUpdate = () => {
    if (!this.isOnScreen) return;
    graphics.renderer.compute(this.compute.computeUpdate);
  };
}
