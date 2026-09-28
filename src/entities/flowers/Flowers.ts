import { storage } from "three/tsl";
import {
  BufferAttribute,
  IndirectStorageBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  Vector3,
} from "three/webgpu";
import { graphics, stage, eventBus } from "../../systems";
import { type State } from "../../Game";
import type { ComputeTask } from "../../systems/rendering/ComputeTask";
import { config, uniforms } from "./config";
import { FlowersCompute } from "./FlowersCompute";
import { FlowerMaterial } from "./FlowerMaterial";
import { debugFlowers } from "./debug";

export class Flowers {
  private mesh: Mesh;
  private computeTask: ComputeTask;

  constructor() {
    const geometry = this.createGeometry();
    geometry.rotateX(-Math.PI / 2);
    geometry.instanceCount = config.COUNT;

    const indexCount = geometry.index!.count;
    const indirectDrawAttribute = new IndirectStorageBufferAttribute(
      new Uint32Array([
        indexCount, // indexCount
        0, // instance count, updated every frame by the atomic counter
        0, // firstIndex
        0, // baseVertex
        0, // firstInstance
      ]),
      1, // size of each argument, all of them are uint so 1
    );

    const atomicIndirectDrawArguments = storage(
      indirectDrawAttribute,
      "uint",
      indirectDrawAttribute.count,
    ).toAtomic();

    // instance count is the second indirect draw argument
    const atomicCounter = atomicIndirectDrawArguments.element(1);
    geometry.setIndirect(indirectDrawAttribute);

    const flowersCompute = new FlowersCompute(atomicCounter);
    const material = new FlowerMaterial(flowersCompute);
    const mesh = new Mesh(geometry, material);

    this.mesh = mesh;
    stage.mainScene.add(this.mesh);
    this.computeTask = graphics.createComputeTask({
      label: "Flowers",
      init: flowersCompute.computeInit,
      update: [
        flowersCompute.computeResetInstanceCount, // always reset first
        flowersCompute.computeUpdate, // then rebuild the visible list
      ],
    });

    this.computeTask.init();

    eventBus.on("engine-render-update", this.onEngineUpdate);
    debugFlowers();
  }

  private createGeometry() {
    // 1 ------- 2
    // | \     / |
    // |   \ /   |
    // |    0    |
    // |   / \   |
    // | /     \ |
    // 4 ------- 3
    const geometry = new InstancedBufferGeometry();

    const halfWidth = 0.5;
    const halfHeight = 0.5;

    const topLeftDepth = 0.15;
    const topRightDepth = 0.22;
    const bottomRightDepth = 0.35;
    const bottomLeftDepth = 0.27;

    const positions = new Float32Array([
      0,
      0,
      0, // center

      -halfWidth,
      halfHeight,
      -topLeftDepth,
      halfWidth,
      halfHeight,
      -topRightDepth,
      halfWidth,
      -halfHeight,
      -bottomRightDepth,
      -halfWidth,
      -halfHeight,
      -bottomLeftDepth,
    ]);

    const uvs = new Float32Array([
      0.5,
      0.5, // center

      0,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
    ]);

    const indices = new Uint8Array([0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 1, 4]);

    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setIndex(new BufferAttribute(indices, 1));

    return geometry;
  }

  private onEngineUpdate = ({ player }: State) => {
    if (!this.computeTask.canUpdate) return;
    this.computeTask.update();
    this.syncFrameUniforms(player.position);
    this.mesh.position.copy(player.position).setY(0);
  };

  private syncFrameUniforms(playerPosition: Vector3) {
    const dx = playerPosition.x - this.mesh.position.x;
    const dz = playerPosition.z - this.mesh.position.z;
    uniforms.uPlayerDeltaXZ.value.set(dx, dz);
    uniforms.uPlayerPosition.value.copy(playerPosition);
  }
}
