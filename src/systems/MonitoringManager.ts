import Stats from "stats-gl";
import { rendererManager } from "./RendererManager";

export default class MonitoringManager {
  stats: Stats;
  private lastSecond = performance.now();

  private drawCallsPanel: Stats.Panel;
  private trianglesPanel: Stats.Panel;
  constructor(enabled: boolean) {
    const stats = new Stats({
      trackGPU: true,
      logsPerSecond: 4,
      graphsPerSecond: 30,
      samplesLog: 40,
      samplesGraph: 10,
      horizontal: false,
      precision: 2,
    });
    stats.dom.classList.add("monitoring-panel");
    if (enabled) document.body.appendChild(stats.dom);
    this.stats = stats;
    // @ts-ignore
    this.drawCallsPanel = this.createNumberPanel(
      "# DRAW CALLS",
      "#fff",
      "#333",
    );
    // @ts-ignore
    this.trianglesPanel = this.createNumberPanel(
      "# TRIANGLES",
      "#ffdab9",
      "#163843",
    );
  }

  private createNumberPanel(name: string, fg: string, bg: string) {
    const panel = this.stats.addPanel(new Stats.Panel(name, fg, bg));

    panel.update = (value) => {
      const ctx = panel.canvas.getContext("2d");
      if (!ctx) return;

      const { width, height } = panel.canvas;

      // Clear background
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = fg;

      // Store original font (used by Stats-GL for the title)
      const originalFont = ctx.font;

      // Title (default font, positioned normally)
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(panel.name, 4, 4);

      // Change font for the number
      ctx.font = "bold 20px Arial"; // Bigger font for the value
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const v = formatter.format(value);
      ctx.fillText(`${v}`, width / 2, height / 1.65);

      // Restore original font for consistency
      ctx.font = originalFont;
    };

    return panel;
  }

  updateCustomPanels() {
    const now = performance.now();
    if (now - this.lastSecond < 1000) return;
    const { render } = rendererManager.renderer.info;
    this.drawCallsPanel.update(render.drawCalls, 0);
    this.trianglesPanel.update(render.triangles, 0);
    this.lastSecond = now;
  }
}

const formatter = new Intl.NumberFormat("en-US", { notation: "compact" });
