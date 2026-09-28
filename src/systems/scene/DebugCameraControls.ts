import { CameraHelper, MOUSE, type PerspectiveCamera } from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import type { DebugPanel } from "../debug/DebugPanel";
import type { EventBus } from "../events/EventBus";
import type { Stage } from "./Stage";

export class DebugCameraControls {
  private stage: Stage;
  private eventBus: EventBus;
  private cameraHelper: CameraHelper;
  private orbitCamera: PerspectiveCamera;
  private controls: MapControls;

  constructor(
    stage: Stage,
    canvas: HTMLCanvasElement,
    eventBus: EventBus,
    debugPanel: DebugPanel,
  ) {
    this.stage = stage;
    this.eventBus = eventBus;

    this.cameraHelper = new CameraHelper(stage.playerCamera);
    this.cameraHelper.visible = false;
    stage.mainScene.add(this.cameraHelper);

    this.orbitCamera = stage.playerCamera.clone();
    this.orbitCamera.near = 0.01;
    this.orbitCamera.far = 5000;

    const controls = new MapControls(this.orbitCamera, canvas);
    controls.screenSpacePanning = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 0.1;
    controls.maxDistance = 1000;
    controls.zoomSpeed = 2;
    controls.panSpeed = 2;
    controls.rotateSpeed = 1;
    controls.mouseButtons = {
      LEFT: MOUSE.ROTATE,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.PAN,
    };
    controls.enabled = false;
    this.controls = controls;

    eventBus.on("engine-render-update", this.onEngineUpdate);
    eventBus.on("engine-render-target-resize", this.onResize);
    this.debug(debugPanel);
  }

  private onEngineUpdate = () => {
    if (this.controls.enabled) this.controls.update();
  };

  private onResize = () => {
    this.cameraHelper.update();
  };

  private onPlayerCameraChange = () => {
    this.stage.playerCamera.updateProjectionMatrix();
    this.cameraHelper.update();
  };

  private onOrbitToggle = (isOrbitEnabled: boolean) => {
    this.stage.renderCamera = this.stage.playerCamera;
    if (isOrbitEnabled) this.stage.renderCamera = this.orbitCamera;
    this.cameraHelper.visible = isOrbitEnabled;
    this.eventBus.emit("engine-camera-change");
  };

  private debug(debugPanel: DebugPanel) {
    const { controls, orbitCamera } = this;
    const { playerCamera } = this.stage;
    const folder = debugPanel.panel.addFolder({
      title: "🎥 Cameras",
      index: 0,
      expanded: false,
    });
    folder
      .addBinding(controls, "enabled", { label: "Enable orbit controls" })
      .on("change", ({ value }) => this.onOrbitToggle(value));

    const player = folder.addFolder({ title: "Player" });
    player
      .addBinding(playerCamera, "near", {
        label: "Near plane",
        min: 0.01,
        max: 5,
        step: 0.01,
      })
      .on("change", this.onPlayerCameraChange);
    player
      .addBinding(playerCamera, "far", {
        label: "Far plane",
        min: 20,
        max: 300,
        step: 1,
      })
      .on("change", this.onPlayerCameraChange);

    const orbit = folder.addFolder({ title: "Orbit" });
    orbit
      .addBinding(orbitCamera, "near", {
        label: "Near plane",
        min: 0.01,
        max: 5,
        step: 0.01,
      })
      .on("change", () => orbitCamera.updateProjectionMatrix());
    orbit
      .addBinding(orbitCamera, "far", {
        label: "Far plane",
        min: 100,
        max: 5000,
        step: 10,
      })
      .on("change", () => orbitCamera.updateProjectionMatrix());
    orbit.addBinding(controls, "zoomSpeed", {
      label: "Zoom speed",
      min: 0.1,
      max: 5,
      step: 0.1,
    });
    orbit.addBinding(controls, "panSpeed", {
      label: "Pan speed",
      min: 0.1,
      max: 10,
      step: 0.1,
    });
    orbit.addBinding(controls, "rotateSpeed", {
      label: "Rotate speed",
      min: 0.1,
      max: 3,
      step: 0.1,
    });
    orbit.addBinding(controls, "screenSpacePanning", {
      label: "Screen space panning",
    });
    orbit.addBinding(controls, "dampingFactor", {
      label: "Damping factor",
      min: 0.01,
      max: 0.3,
      step: 0.01,
    });
  }
}
