import { CameraHelper, PerspectiveCamera, Scene } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { debugManager } from "./DebugManager";
import { rendererManager } from "./RendererManager";

class SceneManager {
  scene: Scene;
  camera: PerspectiveCamera;
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
    const camera = new PerspectiveCamera(45, aspect, 0.01, 100);
    camera.position.set(0, 5, 10);
    this.camera = camera;
    scene.add(camera);

    // Default render camera
    this.renderCamera = camera;

    if (!import.meta.env.DEV) return;
    const cameraHelper = new CameraHelper(camera);
    cameraHelper.visible = false;
    scene.add(cameraHelper);
    this.cameraHelper = cameraHelper;

    // Orbit controls
    const orbitControlsCamera = camera.clone();
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

  private debugScene() {
    if (!this.controls) return;
    const folder = debugManager.panel.addFolder({ title: "🎥 View" });
    folder
      .addBinding(this.controls, "enabled", { label: "Enable orbit controls" })
      .on("change", ({ value: isEnabled }) => {
        if (!this.cameraHelper || !this.orbitControlsCamera) return;
        this.renderCamera = isEnabled ? this.orbitControlsCamera : this.camera;
        this.cameraHelper.visible = isEnabled;
      });
  }

  update() {
    if (this.controls?.enabled) this.controls.update();
  }
}

export const sceneManager = new SceneManager();
