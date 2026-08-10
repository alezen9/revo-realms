import { Mesh, Vector2 } from "three";
import { type State } from "../../../Game";
import {
  sceneManager,
  rendererManager,
  eventsManager,
  monitoringManager,
} from "../../../systems";
import { config, uniforms } from "./config";
import { debugGrass } from "./debug";
import { GrassBladeGeometry } from "./GrassBladeGeometry";
import { GrassMaterial } from "./GrassMaterial";
import { GrassCompute } from "./GrassCompute";
import type { ComputeTask } from "../../../systems/RendererManager/ComputeTask";
import type { GrassMonitoringStats } from "../../../systems/EventsManager";

const UINT32_BYTE_SIZE = Uint32Array.BYTES_PER_ELEMENT;
// instanceCount is the second uint in the indirect draw arguments
const INDIRECT_DRAW_INSTANCE_COUNT_BYTE_OFFSET = UINT32_BYTE_SIZE;

export default class Grass {
  private compute = new GrassCompute();
  private computeTask: ComputeTask;
  private mesh: Mesh;
  private playerDeltaXZ = new Vector2(0, 0);

  constructor() {
    this.computeTask = rendererManager.createComputeTask({
      label: "Grass",
      init: this.compute.computeInit,
      update: [
        this.compute.computeResetInstanceCount,
        this.compute.computeUpdate,
      ],
    });
    this.mesh = this.createMesh();
    sceneManager.scene.add(this.mesh);
    void this.initComputeTaskAsync();

    eventsManager.on("engine-render-update", this.onEngineUpdate);
    debugGrass(uniforms, config);
  }

  private async initComputeTaskAsync() {
    const isInitialized = await this.computeTask.init();
    if (!isInitialized) return;
    monitoringManager?.registerProvider("grass", this.getMonitoringStatsAsync);
  }

  private createMesh() {
    const geometry = new GrassBladeGeometry({
      nSegments: config.SEGMENTS,
      bladeHeight: config.BLADE_HEIGHT,
      bladeWidth: config.BLADE_WIDTH,
    });
    geometry.instanceCount = config.COUNT;
    geometry.setIndirect(this.compute.indirectDrawAttribute);

    const material = new GrassMaterial(this.compute);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  private onEngineUpdate = ({ player }: State) => {
    this.accumulatePlayerDelta(player);
    this.syncPlayerAndCameraUniforms(player);
    this.updateCompute();
    this.mesh.position.copy(player.position).setY(0);
  };

  private accumulatePlayerDelta(player: State["player"]) {
    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    this.playerDeltaXZ.x += dx;
    this.playerDeltaXZ.y += dz;
  }

  private syncPlayerAndCameraUniforms(player: State["player"]) {
    uniforms.uPlayerPosition.value.copy(player.position);

    const projectionMatrix = sceneManager.playerCamera.projectionMatrix;
    uniforms.uFx.value = projectionMatrix.elements[0];
    uniforms.uFy.value = projectionMatrix.elements[5];
    uniforms.uCameraMatrix.value
      .copy(projectionMatrix)
      .multiply(sceneManager.playerCamera.matrixWorldInverse);
  }

  private updateCompute() {
    if (!this.computeTask.canUpdate) return;

    const deltaX = this.playerDeltaXZ.x;
    const deltaZ = this.playerDeltaXZ.y;
    this.playerDeltaXZ.set(0, 0);
    uniforms.uPlayerDeltaXZ.value.set(deltaX, deltaZ);

    this.computeGrassAsync(deltaX, deltaZ);
  }

  private async computeGrassAsync(deltaX: number, deltaZ: number) {
    const computePromise = this.computeTask.update();
    if (!computePromise) {
      this.playerDeltaXZ.x += deltaX;
      this.playerDeltaXZ.y += deltaZ;
      return;
    }

    try {
      await computePromise;
    } catch {
      this.playerDeltaXZ.x += deltaX;
      this.playerDeltaXZ.y += deltaZ;
    }
  }

  private getMonitoringStatsAsync = async (): Promise<GrassMonitoringStats> => {
    const buffer = await rendererManager.renderer.getArrayBufferAsync(
      this.compute.indirectDrawAttribute,
      null,
      INDIRECT_DRAW_INSTANCE_COUNT_BYTE_OFFSET,
      UINT32_BYTE_SIZE,
    );
    const rendered = new Uint32Array(buffer)[0];
    const trianglesPerBlade = config.BLADE_INDEX_COUNT / 3;
    return {
      rendered,
      total: config.COUNT,
      segments: config.SEGMENTS,
      totalTriangles: config.COUNT * trianglesPerBlade,
      renderedTriangles: rendered * trianglesPerBlade,
    };
  };
}
