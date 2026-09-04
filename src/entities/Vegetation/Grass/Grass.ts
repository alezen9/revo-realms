import { Group, Mesh, Vector2 } from "three";
import { ReadbackBuffer } from "three/webgpu";
import { type State } from "../../../Game";
import {
  sceneManager,
  rendererManager,
  eventsManager,
  monitoringManager,
} from "../../../systems";
import { config, uniforms } from "./config";
import { GrassBladeGeometry } from "./GrassBladeGeometry";
import { GrassMaterial } from "./GrassMaterial";
import { GrassCompute } from "./GrassCompute";
import type { ComputeTask } from "../../../systems/RendererManager/ComputeTask";
import type { GrassMonitoringStats } from "../../../systems/EventsManager";
import { TOOLING_FLAGS } from "@systems-tooling-runtime";

const UINT32_BYTE_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const INDIRECT_FIRST_INSTANCE_FEATURE = "indirect-first-instance";
const INDIRECT_DRAW_BYTE_LENGTH =
  config.LOD_COUNT * config.INDIRECT_ARGS_STRIDE * UINT32_BYTE_SIZE;

export default class Grass {
  private compute = new GrassCompute();
  private material = new GrassMaterial(this.compute);
  // every LOD mesh rides the same wrapping tile, so only the group moves
  private tile = new Group();
  private playerDeltaXZ = new Vector2();
  private computeTask: ComputeTask;
  private monitoringReadback?: ReadbackBuffer;

  constructor() {
    this.validateRequiredFeatures();

    this.computeTask = rendererManager.createComputeTask({
      label: "Grass",
      init: this.compute.computeInit,
      update: [
        this.compute.computeResetInstanceCount,
        this.compute.computeUpdate,
      ],
    });

    config.LOD_DRAW_PROFILES.forEach(({ segments }, lod) => {
      this.tile.add(this.createMesh(segments, lod));
    });

    sceneManager.mainScene.add(this.tile);
    this.computeTask.init();

    eventsManager.on("engine-render-update", this.onEngineUpdate);

    if (TOOLING_FLAGS.debug) {
      import("./debug").then(({ debugGrass }) => {
        debugGrass(uniforms, config);
      });
    }
  }

  private validateRequiredFeatures() {
    if (rendererManager.renderer.hasFeature(INDIRECT_FIRST_INSTANCE_FEATURE)) {
      return;
    }

    throw new Error(
      `[Grass] This device does not support the required WebGPU feature "${INDIRECT_FIRST_INSTANCE_FEATURE}"`,
    );
  }

  private createMesh(segments: number, lod: number) {
    const geometry = new GrassBladeGeometry({
      nSegments: segments,
      bladeHeight: config.BLADE_HEIGHT,
    });

    geometry.instanceCount = config.BLADE_COUNT;

    const indirectByteOffset =
      lod * config.INDIRECT_ARGS_STRIDE * UINT32_BYTE_SIZE;

    geometry.setIndirect(
      this.compute.indirectDrawAttribute,
      indirectByteOffset,
    );

    const mesh = new Mesh(geometry, this.material);
    mesh.frustumCulled = false;

    return mesh;
  }

  private onEngineUpdate = ({ player }: State) => {
    this.accumulatePlayerDelta(player);

    uniforms.uPlayerPosition.value.copy(player.position);

    this.updateCompute();

    this.tile.position.set(player.position.x, 0, player.position.z);
  };

  private accumulatePlayerDelta(player: State["player"]) {
    this.playerDeltaXZ.x += player.position.x - this.tile.position.x;

    this.playerDeltaXZ.y += player.position.z - this.tile.position.z;
  }

  private updateCompute() {
    if (!this.computeTask.canUpdate) return;

    const deltaX = this.playerDeltaXZ.x;
    const deltaZ = this.playerDeltaXZ.y;

    uniforms.uPlayerDeltaXZ.value.set(deltaX, deltaZ);
    this.playerDeltaXZ.set(0, 0);

    if (!this.computeTask.update()) {
      this.playerDeltaXZ.set(deltaX, deltaZ);
      return;
    }

    this.registerMonitoringProvider();
  }

  private registerMonitoringProvider() {
    if (!TOOLING_FLAGS.monitoring) return;
    if (!monitoringManager) return;
    if (this.monitoringReadback) return;

    this.monitoringReadback = new ReadbackBuffer(INDIRECT_DRAW_BYTE_LENGTH);
    this.monitoringReadback.name = "grass.indirectDrawArguments";

    monitoringManager.setGrassProvider(this.getMonitoringStatsAsync);
  }

  private getMonitoringStatsAsync = async (): Promise<GrassMonitoringStats> => {
    const monitoringReadback = this.monitoringReadback;

    if (!monitoringReadback) {
      throw new Error("[Grass] monitoring readback is not initialized");
    }

    const readback = await rendererManager.renderer.getArrayBufferAsync(
      this.compute.indirectDrawAttribute,
      monitoringReadback,
    );

    try {
      const buffer = readback.buffer;

      if (!buffer) {
        throw new Error("[Grass] monitoring readback returned no data");
      }

      const drawArguments = new Uint32Array(buffer);
      const renderedPerLod = new Array<number>(config.LOD_COUNT);

      let rendered = 0;
      let renderedTriangles = 0;
      let allocatedTriangles = 0;

      for (let lod = 0; lod < config.LOD_COUNT; lod++) {
        const profile = config.LOD_DRAW_PROFILES[lod];

        const renderedBlades =
          drawArguments[
            lod * config.INDIRECT_ARGS_STRIDE + config.INSTANCE_COUNT_INDEX
          ];

        const trianglesPerBlade = profile.indexCount / 3;

        renderedPerLod[lod] = renderedBlades;
        rendered += renderedBlades;
        renderedTriangles += renderedBlades * trianglesPerBlade;
        allocatedTriangles += config.BLADE_COUNT * trianglesPerBlade;
      }

      return {
        rendered,
        renderedPerLod,
        segmentsPerLod: config.LOD_DRAW_PROFILES.map(
          ({ segments }) => segments,
        ),
        total: config.BLADE_COUNT,
        renderedTriangles,
        allocatedTriangles,
      };
    } finally {
      readback.release();
    }
  };
}
