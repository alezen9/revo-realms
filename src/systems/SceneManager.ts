import { CameraHelper, PerspectiveCamera, Scene, MOUSE } from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { type EventsManager } from "./EventsManager";
import type { DebugManager } from "./DebugManager";

export class SceneManager {
  scene: Scene;
  playerCamera: PerspectiveCamera;
  renderCamera: PerspectiveCamera;
  private eventsManager: EventsManager;
  private cameraHelper?: CameraHelper;
  private controls?: MapControls;
  private orbitControlsCamera?: PerspectiveCamera;

  constructor(eventsManager: EventsManager) {
    this.eventsManager = eventsManager;
    // Scene
    const scene = new Scene();
    this.scene = scene;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    // Camera
    const camera = new PerspectiveCamera(45, aspect, 0.01, 150);
    camera.position.set(0, 5, 10);
    this.playerCamera = camera;
    scene.add(camera);

    // Default render camera
    this.renderCamera = camera;

    this.eventsManager.on("engine-render-target-resize", (sizes) => {
      this.playerCamera.aspect = sizes.aspect;
      this.playerCamera.updateProjectionMatrix();
    });
  }

  private debugScene(debugManager: DebugManager) {
    if (!this.controls) return;
    const folder = debugManager.panel.addFolder({
      title: "🎥 View",
      index: 0,
      expanded: false,
    });
    folder
      .addBinding(this.controls, "enabled", { label: "Enable orbit controls" })
      .on("change", ({ value: isEnabled }) => {
        if (!this.cameraHelper || !this.orbitControlsCamera) return;
        this.renderCamera = isEnabled
          ? this.orbitControlsCamera
          : this.playerCamera;
        this.cameraHelper.visible = isEnabled;
        this.eventsManager.emit("engine-camera-change");
      });

    folder.addBinding(this.controls, "zoomSpeed", {
      min: 0.1,
      max: 5,
      step: 0.1,
    });
    folder.addBinding(this.controls, "panSpeed", {
      min: 0.1,
      max: 10,
      step: 0.1,
    });
    folder.addBinding(this.controls, "rotateSpeed", {
      min: 0.1,
      max: 3,
      step: 0.1,
    });
    folder.addBinding(this.controls, "screenSpacePanning");
    folder.addBinding(this.controls, "dampingFactor", {
      min: 0.01,
      max: 0.3,
      step: 0.01,
    });
  }

  init(rendererCanvas: HTMLCanvasElement, debugManager: DebugManager) {
    if (!import.meta.env.DEV) return;
    const cameraHelper = new CameraHelper(this.playerCamera);
    cameraHelper.visible = false;
    this.scene.add(cameraHelper);
    this.cameraHelper = cameraHelper;

    // Map controls with orbit-style mouse buttons
    const orbitControlsCamera = this.playerCamera.clone();
    const controls = new MapControls(orbitControlsCamera, rendererCanvas);
    orbitControlsCamera.near = 0.01;
    orbitControlsCamera.far = 5000;
    this.orbitControlsCamera = orbitControlsCamera;
    controls.screenSpacePanning = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 0.1;
    controls.maxDistance = 1000;
    controls.zoomSpeed = 2;
    controls.panSpeed = 2;
    controls.rotateSpeed = 1;
    // Set mouse buttons: LEFT=rotate, RIGHT=pan (like OrbitControls)
    controls.mouseButtons = {
      LEFT: MOUSE.ROTATE,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.PAN,
    };
    controls.enabled = false;
    this.controls = controls;

    // Debug
    this.debugScene(debugManager);
  }

  update() {
    if (this.controls?.enabled) this.controls.update();
  }
}
