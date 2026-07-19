import { Mesh, Vector2 } from "three";
import { type State } from "../../../Game";
import {
  sceneManager,
  rendererManager,
  lightingManager,
  eventsManager,
  monitoringManager,
} from "../../../systems";
import { config, uniforms } from "./config";
import { debugGrass } from "./debug";
import { GrassBladeGeometry } from "./GrassBladeGeometry";
import { GrassMaterial } from "./GrassMaterial";
import { GrassSsbo } from "./GrassSsbo";
import type { ComputeTask } from "../../../systems/RendererManager/ComputeTask";
import type { GrassMonitoringStats } from "../../../systems/EventsManager";

const UINT32_BYTE_SIZE = Uint32Array.BYTES_PER_ELEMENT;
// instanceCount is the second uint in the indirect draw arguments
const INDIRECT_DRAW_INSTANCE_COUNT_BYTE_OFFSET = UINT32_BYTE_SIZE;

export default class Grass {
  private ssbo = new GrassSsbo();
  private computeTask: ComputeTask;
  private mesh: Mesh;
  private playerDeltaXZ = new Vector2(0, 0);

  constructor() {
    uniforms.uSunDir.value.copy(lightingManager.sunDirection);
    this.computeTask = rendererManager.createComputeTask({
      label: "Grass",
      init: this.ssbo.computeInit,
      update: [this.ssbo.computeResetInstanceCount, this.ssbo.computeUpdate],
    });
    this.mesh = this.createMesh();
    sceneManager.scene.add(this.mesh);
    this.computeTask.init();

    eventsManager.on("engine-render-update", this.onEngineUpdate);
    monitoringManager?.registerProvider("grass", this.getMonitoringStatsAsync);
    debugGrass(uniforms, config);
  }

  private createMesh() {
    const geometry = new GrassBladeGeometry({
      nSegments: config.SEGMENTS,
      bladeHeight: config.BLADE_HEIGHT,
      bladeWidth: config.BLADE_WIDTH,
    });
    geometry.instanceCount = config.COUNT;
    geometry.setIndirect(this.ssbo.indirectDrawAttribute);

    const material = new GrassMaterial(this.ssbo);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  private onEngineUpdate = ({ player }: State) => {
    this.accumulatePlayerDelta(player);
    this.syncPlayerAndCameraUniforms(player);
    this.updateSsbo();
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
    uniforms.uPlayerRadius.value = player.radius;

    const projectionMatrix = sceneManager.playerCamera.projectionMatrix;
    uniforms.uFx.value = projectionMatrix.elements[0];
    uniforms.uFy.value = projectionMatrix.elements[5];
    uniforms.uCameraMatrix.value
      .copy(projectionMatrix)
      .multiply(sceneManager.playerCamera.matrixWorldInverse);
    sceneManager.playerCamera.getWorldDirection(uniforms.uCameraForward.value);
  }

  private updateSsbo() {
    if (!this.computeTask.canUpdate) return;

    const deltaX = this.playerDeltaXZ.x;
    const deltaZ = this.playerDeltaXZ.y;
    this.playerDeltaXZ.set(0, 0);
    uniforms.uPlayerDeltaXZ.value.set(deltaX, deltaZ);

    this.computeSsboAsync(deltaX, deltaZ);
  }

  private async computeSsboAsync(deltaX: number, deltaZ: number) {
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
      this.ssbo.indirectDrawAttribute,
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
