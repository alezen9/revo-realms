import { CameraHelper, PerspectiveCamera, Scene, MOUSE } from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { debugManager, eventsManager, rendererManager } from ".";
import { type EventsManager } from "./EventsManager";

export class SceneManager {
  scene: Scene;
  playerCamera: PerspectiveCamera;
  renderCamera: PerspectiveCamera;
  private cameraHelper?: CameraHelper;
  private controls?: MapControls;
  private orbitControlsCamera?: PerspectiveCamera;

  constructor(eventsManager: EventsManager) {
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

    eventsManager.on("engine-render-target-resize", (sizes) => {
      this.playerCamera.aspect = sizes.aspect;
      this.playerCamera.updateProjectionMatrix();
    });
  }

  private debugScene() {
    if (!this.controls) return;
    const folder = debugManager.panel.addFolder({ title: "🎥 View", index: 0 });
    folder
      .addBinding(this.controls, "enabled", { label: "Enable orbit controls" })
      .on("change", ({ value: isEnabled }) => {
        if (!this.cameraHelper || !this.orbitControlsCamera) return;
        this.renderCamera = isEnabled
          ? this.orbitControlsCamera
          : this.playerCamera;
        this.cameraHelper.visible = isEnabled;
        eventsManager.emit("engine-camera-change");
      });

    const controlsFolder = folder.addFolder({ title: "Controls" });
    controlsFolder.addBinding(this.controls, "zoomSpeed", { min: 0.1, max: 5, step: 0.1 });
    controlsFolder.addBinding(this.controls, "panSpeed", { min: 0.1, max: 10, step: 0.1 });
    controlsFolder.addBinding(this.controls, "rotateSpeed", { min: 0.1, max: 3, step: 0.1 });
    controlsFolder.addBinding(this.controls, "screenSpacePanning");
    controlsFolder.addBinding(this.controls, "dampingFactor", { min: 0.01, max: 0.3, step: 0.01 });
  }

  init() {
    if (!import.meta.env.DEV) return;
    const cameraHelper = new CameraHelper(this.playerCamera);
    cameraHelper.visible = false;
    this.scene.add(cameraHelper);
    this.cameraHelper = cameraHelper;

    // Map controls with orbit-style mouse buttons
    const orbitControlsCamera = this.playerCamera.clone();
    const controls = new MapControls(
      orbitControlsCamera,
      rendererManager.canvas,
    );
    orbitControlsCamera.near = 0.01;
    orbitControlsCamera.far = 5000;
    this.orbitControlsCamera = orbitControlsCamera;
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
    this.debugScene();
  }

  update() {
    if (this.controls?.enabled) this.controls.update();
  }
}
