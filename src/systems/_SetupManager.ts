import { GPUFeatureName } from "three/src/renderers/webgpu/utils/WebGPUConstants.js";

export class _SetupManager {
  private async initPhysicsAsync() {
    const rapier = await import("@dimforge/rapier3d-compat");
    await rapier.init();
  }

  private async initWebGpuDeviceAsync() {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)
      throw new Error("WebGPU initAsync: Unable to create WebGPU adapter.");
    const features = Object.values(GPUFeatureName);

    const supportedFeatures = [];

    for (const name of features) {
      if (adapter.features.has(name)) supportedFeatures.push(name);
    }

    const deviceDescriptor = {
      requiredFeatures: supportedFeatures,
    };

    const device = await adapter.requestDevice(deviceDescriptor);
    if (!device)
      throw new Error("WebGPU initAsync: Unable to create WebGPU device.");
    return device;
  }

  async initAsync() {
    const [device] = await Promise.all([
      this.initWebGpuDeviceAsync(),
      this.initPhysicsAsync(),
    ]);
    return device;
  }
}
