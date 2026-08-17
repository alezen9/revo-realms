import { Group, Mesh, Vector2 } from "three";
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
const INDIRECT_FIRST_INSTANCE_FEATURE = "indirect-first-instance";

export default class Grass {
  private compute = new GrassCompute();
  private computeTask: ComputeTask;
  private material = new GrassMaterial(this.compute);
  // every LOD mesh rides the same wrapping tile, so only the group moves
  private tile = new Group();
  private playerDeltaXZ = new Vector2(0, 0);
  private drawProfiles: typeof config.LOD_DRAW_PROFILES;
  private hasRegisteredMonitoringProvider = false;

  constructor() {
    const isLodEnabled = rendererManager.renderer.hasFeature(
      INDIRECT_FIRST_INSTANCE_FEATURE,
    );
    this.drawProfiles = isLodEnabled
      ? config.LOD_DRAW_PROFILES
      : [config.FALLBACK_DRAW_PROFILE];
    if (!isLodEnabled) this.configureFallback();

    this.computeTask = rendererManager.createComputeTask({
      label: "Grass",
      init: this.compute.computeInit,
      update: [
        this.compute.computeResetInstanceCount,
        this.compute.computeUpdate,
      ],
    });
    this.drawProfiles.forEach(({ segments }, lod) => {
      this.tile.add(this.createMesh(segments, lod, this.material));
    });
    sceneManager.scene.add(this.tile);
    void this.computeTask.init();

    eventsManager.on("engine-render-update", this.onEngineUpdate);
    debugGrass(uniforms, config);
  }

  private configureFallback() {
    const { indexCount, segments } = config.FALLBACK_DRAW_PROFILE;
    this.compute.configureSingleDraw(indexCount);
    console.warn(
      `[Grass] "${INDIRECT_FIRST_INSTANCE_FEATURE}" is unavailable; using one ${segments}-segment draw`,
    );
  }

  private createMesh(segments: number, lod: number, material: GrassMaterial) {
    const geometry = new GrassBladeGeometry({
      nSegments: segments,
      bladeHeight: config.BLADE_HEIGHT,
    });
    geometry.instanceCount = config.COUNT;
    const indirectByteOffset =
      lod * config.INDIRECT_ARGS_STRIDE * UINT32_BYTE_SIZE;
    geometry.setIndirect(
      this.compute.indirectDrawAttribute,
      indirectByteOffset,
    );

    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  private onEngineUpdate = ({ player }: State) => {
    this.accumulatePlayerDelta(player);
    this.syncPlayerAndCameraUniforms(player);
    this.updateCompute();
    this.tile.position.copy(player.position).setY(0);
  };

  private accumulatePlayerDelta(player: State["player"]) {
    const dx = player.position.x - this.tile.position.x;
    const dz = player.position.z - this.tile.position.z;
    this.playerDeltaXZ.x += dx;
    this.playerDeltaXZ.y += dz;
  }

  private syncPlayerAndCameraUniforms(player: State["player"]) {
    uniforms.uPlayerPosition.value.copy(player.position);
    uniforms.uCameraPosition.value.copy(sceneManager.playerCamera.position);

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
      this.registerMonitoringProvider();
    } catch {
      this.playerDeltaXZ.x += deltaX;
      this.playerDeltaXZ.y += deltaZ;
    }
  }

  private registerMonitoringProvider() {
    if (!monitoringManager || this.hasRegisteredMonitoringProvider) return;
    monitoringManager.setGrassProvider(this.getMonitoringStatsAsync);
    this.hasRegisteredMonitoringProvider = true;
  }

  private getMonitoringStatsAsync = async (): Promise<GrassMonitoringStats> => {
    const buffer = await rendererManager.renderer.getArrayBufferAsync(
      this.compute.indirectDrawAttribute,
    );
    const drawArguments = new Uint32Array(buffer);
    const renderedPerLod = this.drawProfiles.map(
      (_, lod) =>
        drawArguments[
          lod * config.INDIRECT_ARGS_STRIDE + config.INSTANCE_COUNT_INDEX
        ],
    );

    let rendered = 0;
    let renderedTriangles = 0;
    let allocatedTriangles = 0;
    for (let lod = 0; lod < this.drawProfiles.length; lod++) {
      const trianglesPerBlade = this.drawProfiles[lod].indexCount / 3;
      rendered += renderedPerLod[lod];
      renderedTriangles += renderedPerLod[lod] * trianglesPerBlade;
      allocatedTriangles += config.COUNT * trianglesPerBlade;
    }

    return {
      rendered,
      renderedPerLod,
      segmentsPerLod: this.drawProfiles.map(({ segments }) => segments),
      total: config.COUNT,
      renderedTriangles,
      allocatedTriangles,
    };
  };
}
