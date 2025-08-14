import { CameraHelper, PerspectiveCamera, Scene } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { debugManager } from "./DebugManager";
import { rendererManager } from "./RendererManager";
import { eventsManager } from "./EventsManager";

class SceneManager {
  scene: Scene;
  playerCamera: PerspectiveCamera;
  renderCamera: PerspectiveCamera;
  private cameraHelper?: CameraHelper;
  private controls?: OrbitControls;
  private orbitControlsCamera?: PerspectiveCamera;

  constructor() {
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
  }

  private debugScene() {
    if (!this.controls) return;
    const folder = debugManager.panel.addFolder({ title: "🎥 View" });
    folder
      .addBinding(this.controls, "enabled", { label: "Enable orbit controls" })
      .on("change", ({ value: isEnabled }) => {
        if (!this.cameraHelper || !this.orbitControlsCamera) return;
        this.renderCamera = isEnabled
          ? this.orbitControlsCamera
          : this.playerCamera;
        this.cameraHelper.visible = isEnabled;
        eventsManager.emit("camera-changed");
      });
  }

  init() {
    if (!import.meta.env.DEV) return;
    const cameraHelper = new CameraHelper(this.playerCamera);
    cameraHelper.visible = false;
    this.scene.add(cameraHelper);
    this.cameraHelper = cameraHelper;

    // Orbit controls
    const orbitControlsCamera = this.playerCamera.clone();
    const controls = new OrbitControls(
      orbitControlsCamera,
      rendererManager.canvas,
    );
    orbitControlsCamera.near = 0.01;
    orbitControlsCamera.far = 5000;
    this.orbitControlsCamera = orbitControlsCamera;
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.enabled = false;
    this.controls = controls;

    // Debug
    this.debugScene();
  }

  update() {
    if (this.controls?.enabled) this.controls.update();
  }
}

export const sceneManager = new SceneManager();
