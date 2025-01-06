import { GridHelper, WebGPURenderer } from "three/webgpu";
import { Scene, PointLight, Clock, Object3D, PerspectiveCamera } from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import Terrain from "../game/Terrain";
import { World } from "@dimforge/rapier3d";
import Player from "../game/Player";
import Stats from "stats-gl";

export type Rapier = typeof import("@dimforge/rapier3d");

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

    // Light
    const pointLoght = new PointLight("white", 50);
    pointLoght.position.set(1, 5, 0);
    this.scene.add(pointLoght);

    // Grid helper
    const gridHelper = new GridHelper(1000, 1000, "black", "grey");
    this.scene.add(gridHelper);

    // Camera
    this.camera = new PerspectiveCamera(45, sizes.aspect, 0.1, 100);
    this.camera.position.set(0, 2, 7.5);
    this.scene.add(this.camera);

    // Controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.05;

    // Clock
    this.clock = new Clock(false);

    // On resize
    const resizeObserver = new ResizeObserver(this.onResize);
    resizeObserver.observe(document.body);

    // Physics-affected objects
    import("@dimforge/rapier3d").then((rapier) => {
      this.world = new rapier.World({ x: 0, y: -9.81, z: 0 }); // Gravity points downwards

      // Terrain
      new Terrain(this.world, this.scene);

      // Player
      this.player = new Player(this.world, this.scene);
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

  startLoop(callback?: (params: { clock: Clock }) => void) {
    this.clock.start();
    const loop = async () => {
      callback?.({ clock: this.clock });

      if (this.world) {
        this.world.step();
        this.player?.update();
      }

      // Update controls
      this.controls.update();

      // Render
      await this.renderer.renderAsync(this.scene, this.camera);

      // Next frame
      requestAnimationFrame(loop);
      this.stats.update();
    };
    loop();
  }

  addToScene(...objects: Object3D[]) {
    this.scene.add(...objects);
  }
}
