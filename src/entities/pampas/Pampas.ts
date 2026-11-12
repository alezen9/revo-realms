import { storage } from "three/tsl";
import {
  IndirectStorageBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
} from "three/webgpu";
import { assets, debugPanel, eventBus, graphics, stage } from "../../systems";
import { type State } from "../../Game";
import { srgbColorTarget } from "../../systems/debug/tweakpaneColor";
import type { ComputeTask } from "../../systems/rendering/ComputeTask";
import { config, uniforms } from "./config";
import { PampasCompute } from "./PampasCompute";
import { PampasMaterial } from "./PampasMaterial";

export class Pampas {
  private mesh: Mesh;
  private computeTask: ComputeTask;

  constructor() {
    const { pampasModel } = assets.resources;
    const model = assets.getMesh("pampas", pampasModel);
    const geometry = new InstancedBufferGeometry();
    geometry.setAttribute("position", model.geometry.getAttribute("position"));
    geometry.setAttribute("uv", model.geometry.getAttribute("uv"));
    geometry.setIndex(model.geometry.getIndex());
    geometry.instanceCount = config.COUNT;

    const indexCount = geometry.index?.count ?? 0;
    const indirectDrawAttribute = new IndirectStorageBufferAttribute(
      // indexCount, instanceCount, firstIndex, baseVertex, firstInstance
      new Uint32Array([indexCount, 0, 0, 0, 0]),
      1,
    );
    const atomicIndirectDrawArguments = storage(
      indirectDrawAttribute,
      "uint",
      indirectDrawAttribute.count,
    ).toAtomic();
    const atomicInstanceCount = atomicIndirectDrawArguments.element(1);
    geometry.setIndirect(indirectDrawAttribute);

    const pampasCompute = new PampasCompute(atomicInstanceCount);
    this.mesh = new Mesh(geometry, new PampasMaterial(pampasCompute));
    stage.mainScene.add(this.mesh);

    this.computeTask = graphics.createComputeTask({
      label: "Pampas",
      init: pampasCompute.computeInit,
      update: [
        pampasCompute.computeResetInstanceCount,
        pampasCompute.computeUpdate,
      ],
    });
    this.computeTask.init();

    eventBus.on("engine-render-update", this.onEngineUpdate);
    this.debug();
  }

  private onEngineUpdate = ({ player }: State) => {
    if (!this.computeTask.canUpdate) return;
    this.computeTask.update();

    const deltaX = player.position.x - this.mesh.position.x;
    const deltaZ = player.position.z - this.mesh.position.z;
    uniforms.uPlayerDeltaXZ.value.set(deltaX, deltaZ);
    uniforms.uPlayerPosition.value.copy(player.position);
    this.mesh.position.copy(player.position).setY(0);
  };

  private debug() {
    const folder = debugPanel.panel.addFolder({
      title: "🌾 Pampas",
      expanded: false,
    });
    folder.addBinding(uniforms.uDensity, "value", {
      label: "Density",
      min: 0,
      max: 1,
      step: 0.01,
    });
    folder.addBinding(srgbColorTarget(uniforms.uTint.value), "value", {
      label: "Tint",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uBrightness, "value", {
      label: "Brightness",
      min: 0,
      max: 3,
      step: 0.01,
    });
    folder.addBinding(uniforms.uAmbientSway, "value", {
      label: "Ambient sway",
      min: 0,
      max: 0.5,
      step: 0.01,
    });
    folder.addBinding(uniforms.uGustLean, "value", {
      label: "Gust lean",
      min: 0,
      max: 1.5,
      step: 0.01,
    });
    folder.addBinding(uniforms.uPlayerPush, "value", {
      label: "Player push",
      min: 0,
      max: 2,
      step: 0.01,
    });
    folder.addBinding(uniforms.uFlutter, "value", {
      label: "Flutter",
      min: 0,
      max: 0.3,
      step: 0.005,
    });
  }
}
