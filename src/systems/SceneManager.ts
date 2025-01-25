import { PerspectiveCamera, Scene } from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import RendererManager from "./RendererManager";

export default class SceneManager {
  scene: Scene;
  camera: PerspectiveCamera;
  private controls: OrbitControls;

  constructor(rendererManager: RendererManager) {
    // Scene
    const scene = new Scene();
    this.scene = scene;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    // Camera
    const camera = new PerspectiveCamera(45, aspect, 0.01, 1000);
    camera.position.set(0, 5, 10);
    this.camera = camera;
    scene.add(camera);

    // Orbit controls
    const controls = new OrbitControls(camera, rendererManager.canvas);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.enabled = false;
    this.controls = controls;
  }

  update() {
    if (this.controls.enabled) this.controls.update();
  }
}
