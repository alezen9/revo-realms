import { WebGPURenderer } from "three/webgpu";
import {
  Scene,
  Clock,
  PerspectiveCamera,
  ACESFilmicToneMapping,
  VSMShadowMap,
} from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { World } from "@dimforge/rapier3d-compat";
import Player from "../entities/Player";
import Stats from "stats-gl";
import InfiniteFloor from "../entities/InfiniteFloor";
import PostProcessing from "./PostProcessing";
import LightingSystem from "../systems/LightingSystem";
import AssetManager from "../systems/AssetManager";
import InputManager from "../systems/InputManager";

export type State = {
  camera: PerspectiveCamera;
  scene: Scene;
  clock: Clock;
  world: World;
  assetManager: AssetManager;
  inputManager: InputManager;
  lighting?: LightingSystem;
  player?: Player;
};

type Sizes = { width: number; height: number; dpr: number; aspect: number };

export default class Engine {
  private stats: Stats;
  private canvas: HTMLCanvasElement;
  private camera: PerspectiveCamera;
  private scene: Scene;
  private controls: OrbitControls;
  private clock: Clock;
  private world?: World;
  private player?: Player;
  private infiniteFloor?: InfiniteFloor;
  private assetManager: AssetManager;
  private inputManager: InputManager;
  private lighting?: LightingSystem;
  private postprocessing: PostProcessing;

  constructor() {
    // Canvas
    this.canvas = document.createElement("canvas");
    this.canvas.classList.add("revo-realms");
    document.body.appendChild(this.canvas);

    // Asset manager
    this.assetManager = new AssetManager();

    // Input manager
    this.inputManager = new InputManager();

    // Renderer
    const sizes = this.getSizes();
    const renderer = new WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(sizes.dpr);
    renderer.toneMapping = ACESFilmicToneMapping;

    // Scene
    this.scene = new Scene();

    // Camera
    this.camera = new PerspectiveCamera(45, sizes.aspect, 0.01, 1000);
    this.camera.position.set(0, 5, 10);
    this.scene.add(this.camera);

    // Postprocessing
    this.postprocessing = new PostProcessing({
      renderer,
      scene: this.scene,
      camera: this.camera,
    });
    this.postprocessing.renderer;

    // Stats
    this.stats = new Stats({
      logsPerSecond: 4,
      graphsPerSecond: 30,
      samplesLog: 40,
      samplesGraph: 10,
      horizontal: false,
      precision: 2,
    });
    document.body.appendChild(this.stats.dom);

    // Controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.enabled = false;

    // Clock
    this.clock = new Clock(false);

    // Physics-affected objects
    import("@dimforge/rapier3d-compat").then(async (rapier) => {
      await rapier.init();
      this.world = new World({ x: 0, y: -9.81, z: 0 }); // Gravity points downwards

      const state: State = {
        camera: this.camera,
        clock: this.clock,
        scene: this.scene,
        assetManager: this.assetManager,
        inputManager: this.inputManager,
        world: this.world,
      };

      // Player
      this.player = new Player(state);
      state.player = this.player;

      // Light
      this.lighting = new LightingSystem(state);
      state.lighting = this.lighting;

      // Infinite Floor
      this.infiniteFloor = new InfiniteFloor(state);
    });
  }

  private getSizes(): Sizes {
    const width = window.innerWidth;
    const height = window.innerHeight;
    return {
      width,
      height,
      dpr: Math.min(window.devicePixelRatio, 2),
      aspect: width / height,
    };
  }

  private onResize() {
    const sizes = this.getSizes();
    // Update camera
    this.camera.aspect = sizes.aspect;
    this.camera.updateProjectionMatrix();

    // Update renderer
    this.postprocessing.renderer.setSize(sizes.width, sizes.height);
    this.postprocessing.renderer.setPixelRatio(sizes.dpr);
  }

  async startLoop(callback?: (state: State) => void) {
    await this.stats.init(this.postprocessing.renderer);
    this.clock.start();
    const loop = async () => {
      this.stats.update();

      if (this.world) {
        const state: State = {
          camera: this.camera,
          clock: this.clock,
          scene: this.scene,
          world: this.world,
          assetManager: this.assetManager,
          inputManager: this.inputManager,
          lighting: this.lighting,
          player: this.player,
        };

        callback?.(state);

        this.world.step();
        this.player?.update(state);
        this.infiniteFloor?.update(state);
        this.lighting?.update(state);
      }

      // Update controls
      if (this.controls.enabled) this.controls.update();

      // Render
      await this.postprocessing.renderAsync();

      // Next frame
      requestAnimationFrame(loop);
    };

    // On resize
    const resizeObserver = new ResizeObserver(() => {
      this.onResize();
    });
    resizeObserver.observe(document.body);

    loop();
  }
}
