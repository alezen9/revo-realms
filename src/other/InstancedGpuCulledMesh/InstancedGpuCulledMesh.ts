import {
  BufferGeometry,
  Camera,
  Group,
  InstancedMesh,
  Material,
  Scene,
} from "three";
import RendererManager from "../../systems/RendererManager";

const str = /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> instancePositions : array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> visibilityBuffer : array<u32>;
@group(0) @binding(2) var<storage, read_write> drawCount : u32;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (index >= instancePositions.length()) { return; }

    let worldPos = instancePositions[index].xyz;
    let clipPos = cameraMatrix * vec4(worldPos, 1.0);

    let inFrustum = (
        clipPos.x > -clipPos.w && clipPos.x < clipPos.w &&
        clipPos.y > -clipPos.w && clipPos.y < clipPos.w &&
        clipPos.z > 0.0 && clipPos.z < clipPos.w
    );

    if (inFrustum) {
        let visibleIndex = atomicAdd(drawCount, 1);
        visibilityBuffer[visibleIndex] = index;
    }
}
`;

export default class InstancedGpuCulledMesh extends InstancedMesh {
  readonly isInstancedGpuCulledMesh = true;
  constructor(...args: ConstructorParameters<typeof InstancedMesh>) {
    super(...args);
  }

  // @override
  // @ts-expect-error expects a WebGL renderer but we have a WebGPU renderer
  onBeforeRender(
    rendererManager: RendererManager,
    scene: Scene,
    camera: Camera,
    geometry: BufferGeometry,
    material: Material,
    group: Group,
  ) {
    if (!(rendererManager instanceof RendererManager)) return;
    console.log("here");
    // // Run compute shader for culling
    // this.runComputePass(rendererManager);

    // // Perform indirect draw call
    // this.runIndirectDrawPass(rendererManager);
  }

  // private runComputePass(rendererManager: RendererManager) {
  //   const commandEncoder = rendererManager.device.createCommandEncoder();
  //   const computePass = commandEncoder.beginComputePass();
  //   computePass.setPipeline(rendererManager.renderer.computePipeline);
  //   computePass.dispatchWorkgroups(Math.ceil(this.count / 64));
  //   computePass.end();
  //   rendererManager.device.queue.submit([commandEncoder.finish()]);
  // }

  //   runIndirectDrawPass(rendererManager: RendererManager) {
  //     const commandEncoder = rendererManager.device.createCommandEncoder();

  //     const renderPass = commandEncoder.beginRenderPass({
  //       colorAttachments: [
  //         {
  //           view: rendererManager.renderer._frameBufferTarget?.texture.createView(),
  //           loadOp: "load",
  //           storeOp: "store",
  //         },
  //       ],
  //     });

  //     renderPass.setPipeline(this.renderPipeline);
  //     renderPass.setBindGroup(0, this.bindGroup);
  //     renderPass.drawIndirect(this.drawCountBuffer, 0);
  //     renderPass.end();

  //     rendererManager.device.queue.submit([commandEncoder.finish()]);
  //   }
}
