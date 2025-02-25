import { Scene, Clock, PerspectiveCamera } from "three";
import { World } from "@dimforge/rapier3d-compat";
import Player from "./entities/Player";
import PortfolioRealm from "./realms/PortfolioRealm";
import LightingSystem from "./systems/LightingSystem";
import InputManager from "./systems/InputManager";
import RendererManager from "./systems/RendererManager";
import SceneManager from "./systems/SceneManager";
import { WebGPURenderer } from "three/webgpu";
import Grass from "./entities/Grass";

export type State = {
  camera: PerspectiveCamera;
  scene: Scene;
  clock: Clock;
  renderer: WebGPURenderer;
  inputManager: InputManager;
  world: World;
  lighting: LightingSystem;
  player: Player;
};

type Sizes = { width: number; height: number; dpr: number; aspect: number };

export default class Game {
  private rendererManager: RendererManager;
  private sceneManager: SceneManager;
  private inputManager: InputManager;
  private clock: Clock;
  private world: World;

  private player: Player;
  private realm: PortfolioRealm;
  private lighting: LightingSystem;

  private grass: Grass;

  constructor() {
    this.rendererManager = new RendererManager();
    this.sceneManager = new SceneManager(this.rendererManager);
    this.inputManager = new InputManager();

    this.clock = new Clock(false);

    this.lighting = new LightingSystem(this.sceneManager.scene);

    this.world = new World({ x: 0, y: -9.81, z: 0 });

    this.player = new Player({
      scene: this.sceneManager.scene,
      inputManager: this.inputManager,
      lighting: this.lighting,
      world: this.world,
    });

    this.realm = new PortfolioRealm({
      scene: this.sceneManager.scene,
      world: this.world,
    });

    // Grass
    this.grass = new Grass(this.sceneManager.scene);
  }

  private getSizes(): Sizes {
    const width = window.innerWidth;
    const height = window.innerHeight;
    return {
      width,
      height,
      dpr: Math.min(window.devicePixelRatio, 1.5),
      aspect: width / height,
    };
  }

  private onResize() {
    const sizes = this.getSizes();
    // Update camera
    this.sceneManager.camera.aspect = sizes.aspect;
    this.sceneManager.camera.updateProjectionMatrix();

    // Update renderer
    this.rendererManager.renderer.setSize(sizes.width, sizes.height);
    this.rendererManager.renderer.setPixelRatio(sizes.dpr);
  }

  async startLoop() {
    await this.rendererManager.init(this.sceneManager);
    this.clock.start();

    const state: State = {
      clock: this.clock,
      scene: this.sceneManager.scene,
      camera: this.sceneManager.camera,
      inputManager: this.inputManager,
      lighting: this.lighting,
      world: this.world,
      player: this.player,
      renderer: this.rendererManager.renderer,
    };

    const loop = async () => {
      if (import.meta.env.DEV) this.sceneManager.update();

      this.world.step();
      this.player.update(state);
      this.realm.update(state);
      this.lighting.update(state);
      this.grass.updateAsync(state);

      await this.rendererManager.renderAsync(
        this.sceneManager.scene,
        this.sceneManager.renderCamera,
      );
    };

    // On resize
    const resizeObserver = new ResizeObserver(() => {
      this.onResize();
    });
    resizeObserver.observe(document.body);

    this.rendererManager.renderer.setAnimationLoop(loop);
  }
}
