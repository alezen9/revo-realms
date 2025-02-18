export default class PerformanceMonitor {
  private fpsHistory: Float32Array;
  private fpsIndex = 0;
  private lastFrameTime = performance.now();
  private gpuInfo: string = "Unknown GPU";
  private lastSecond = performance.now();
  private frameCounter = 0;

  constructor(private maxSamples = 60) {
    this.fpsHistory = new Float32Array(maxSamples); // Fixed-size buffer
    this.initGPUInfo();
    this.startMonitoring();
  }

  private async initGPUInfo() {
    if (navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        this.gpuInfo = adapter
          ? `${adapter.info.vendor} - ${adapter.info.architecture}`
          : "WebGPU Adapter Not Found";
      } catch (e) {
        this.gpuInfo = "WebGPU Not Supported";
      }
    } else {
      this.gpuInfo = "WebGPU Not Available";
    }
  }

  private startMonitoring() {
    const updateStats = () => {
      const now = performance.now();
      const deltaTime = now - this.lastFrameTime;
      this.lastFrameTime = now;

      const fps = 1000 / deltaTime;
      this.fpsHistory[this.fpsIndex] = fps;
      this.fpsIndex = (this.fpsIndex + 1) % this.maxSamples;
      this.frameCounter++;

      // Every second, log performance stats
      if (now - this.lastSecond >= 1000) {
        this.logPerformance(deltaTime);
        this.lastSecond = now;
      }

      requestAnimationFrame(updateStats);
    };

    requestAnimationFrame(updateStats);
  }

  private logPerformance(frameTime: number) {
    const avgFps =
      this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.maxSamples;

    console.clear();
    console.log(`🎮 **Performance Report**`);
    console.log(`📊 Average FPS: ${avgFps.toFixed(2)}`);
    console.log(`⏱️ Frame Time: ${frameTime.toFixed(2)}ms`);
    console.log(`🖥️ GPU: ${this.gpuInfo}`);

    if (avgFps < 55) {
      console.warn("⚠️ FPS is dropping below 60! Consider optimizations.");
    }
    if (frameTime > 16.67) {
      console.warn(
        "⚠️ Frame time is above 16.67ms, potential performance bottleneck.",
      );
    }
  }
}
