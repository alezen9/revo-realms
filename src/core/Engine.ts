import { WebGPURenderer } from "three/webgpu";
import {
  Scene,
  Clock,
  Object3D,
  PerspectiveCamera,
  ACESFilmicToneMapping,
} from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { World } from "@dimforge/rapier3d";
import Player from "../game/Player";
import Stats from "stats-gl";
import InfiniteFloor from "../game/InfiniteFloor";
import Light from "../game/Light";

// export type Rapier = typeof import("@dimforge/rapier3d");

export type State = {
  renderer: WebGPURenderer;
  camera: PerspectiveCamera;
  scene: Scene;
  clock: Clock;
  world: World;
  light?: Light;
  player?: Player;
};

type Sizes = { width: number; height: number; dpr: number; aspect: number };

export default class Engine {
  private stats: Stats;
  private canvas: HTMLCanvasElement;
  private renderer: WebGPURenderer;
  private camera: PerspectiveCamera;
  private scene: Scene;
  private controls: OrbitControls;
  private clock: Clock;
  private world?: World;
  private player?: Player;
  private infiniteFloor?: InfiniteFloor;
  private light?: Light;

  constructor() {
    // Canvas
    this.canvas = document.createElement("canvas");
    this.canvas.classList.add("revo-realms");
    document.body.appendChild(this.canvas);

    // Renderer
    const sizes = this.getSizes();
    this.renderer = new WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setSize(sizes.width, sizes.height);
    this.renderer.setPixelRatio(sizes.dpr);
    this.renderer.toneMapping = ACESFilmicToneMapping;

    // Stats
    this.stats = new Stats({
      trackGPU: true,
      logsPerSecond: 4,
      graphsPerSecond: 30,
      samplesLog: 40,
      samplesGraph: 10,
      horizontal: false,
      precision: 2,
    });
    document.body.appendChild(this.stats.dom);
    this.stats.init(this.renderer);

    // Scene
    this.scene = new Scene();

    // Camera
    this.camera = new PerspectiveCamera(45, sizes.aspect, 0.01, 1000);
    this.camera.position.set(0, 5, 10);
    this.scene.add(this.camera);

    // Controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.enabled = false;

    // Clock
    this.clock = new Clock(false);

    // Physics-affected objects
    import("@dimforge/rapier3d").then((rapier) => {
      this.world = new rapier.World({ x: 0, y: -9.81, z: 0 }); // Gravity points downwards

      const state: State = {
        renderer: this.renderer,
        camera: this.camera,
        clock: this.clock,
        scene: this.scene,
        world: this.world,
      };

      // Player
      this.player = new Player(state);
      state.player = this.player;

      // Light
      this.light = new Light(state);
      state.light = this.light;

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
    this.renderer.setSize(sizes.width, sizes.height);
    this.renderer.setPixelRatio(sizes.dpr);
  }

  startLoop(callback?: (state: State) => void) {
    this.clock.start();
    const loop = async () => {
      // Update stats
      this.stats.update();

      if (this.world) {
        const state = {
          renderer: this.renderer,
          camera: this.camera,
          clock: this.clock,
          scene: this.scene,
          world: this.world,
          light: this.light,
          player: this.player,
        };

        callback?.(state);

        this.world.step();
        this.player?.update(state);
        this.infiniteFloor?.update(state);
        this.light?.update(state);
      }

      // Update controls
      if (this.controls.enabled) this.controls.update();

      // Render
      await this.renderer.renderAsync(this.scene, this.camera);

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

  addToScene(...objects: Object3D[]) {
    this.scene.add(...objects);
  }
}
