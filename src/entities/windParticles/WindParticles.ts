import { CircleGeometry, InstancedMesh } from "three/webgpu";
import { type State } from "../../Game";
import type { ComputeTask } from "../../systems/rendering/ComputeTask";
import { eventBus, pipelineWarmup, graphics, stage } from "../../systems";
import { config, uniforms } from "./WindParticlesConfig";
import { WindParticlesCompute } from "./WindParticlesCompute";
import { debugWindParticles } from "./WindParticlesDebug";
import { WindParticlesMaterial } from "./WindParticlesMaterial";

export class WindParticles {
  private particlesCompute = new WindParticlesCompute();
  private computeTask: ComputeTask;
  private mesh: InstancedMesh;

  constructor() {
    this.computeTask = graphics.createComputeTask({
      label: "WindParticles",
      init: this.particlesCompute.computeInit,
      update: this.particlesCompute.computeUpdate,
    });
    this.mesh = this.createMesh();
    stage.mainScene.add(this.mesh);
    this.computeTask.init();
    this.registerPrewarmTask();
    eventBus.on("engine-render-update", this.onEngineUpdate);
    debugWindParticles();
  }

  private createMesh() {
    const mesh = new InstancedMesh(
      new CircleGeometry(0.5, 8),
      new WindParticlesMaterial(this.particlesCompute),
      config.PARTICLE_COUNT,
    );
    mesh.visible = false;
    mesh.frustumCulled = false;
    return mesh;
  }

  private registerPrewarmTask() {
    pipelineWarmup.registerTask({
      prepare: async () => {
        this.mesh.visible = true;
        await this.computeTask.init();
        await this.computeTask.update();
      },
      restore: () => {},
    });
  }

  private onEngineUpdate = ({ player, delta }: State) => {
    const deltaX = player.position.x - this.mesh.position.x;
    const deltaZ = player.position.z - this.mesh.position.z;
    uniforms.uPlayerDeltaXZ.value.set(deltaX, deltaZ);
    uniforms.uPlayerPosition.value.copy(player.position);
    uniforms.uDelta.value = delta;
    this.mesh.position.copy(player.position).setY(0);
    this.mesh.visible = true;
    this.computeTask.update();
  };
}
