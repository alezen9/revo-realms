import { Scene, Clock, PerspectiveCamera } from "three";
import { World } from "@dimforge/rapier3d-compat";
import Player from "./entities/Player";
import PortfolioRealm from "./realms/PortfolioRealm";
import LightingSystem from "./systems/LightingSystem";
import InputManager from "./systems/InputManager";
import RendererManager from "./systems/RendererManager";
import SceneManager from "./systems/SceneManager";
import MonitoringManager from "./systems/MonitoringManager";
// import PostprocessingManager from "./systems/PostprocessingManager";
import Environmentallumination from "./systems/Environmentallumination";
import NewGrass from "./entities/NewGrass";
import { WebGPURenderer } from "three/webgpu";

export type State = {
  camera: PerspectiveCamera;
  scene: Scene;
  clock: Clock;
  renderer: WebGPURenderer;
  inputManager: InputManager;
  world: World;
  lighting: LightingSystem;
  environmentalIllumination: Environmentallumination;
  player: Player;
};

type Sizes = { width: number; height: number; dpr: number; aspect: number };

export default class Game {
  private rendererManager: RendererManager;
  private sceneManager: SceneManager;
  private inputManager: InputManager;
  private monitoringManager: MonitoringManager;
  // private postprocessingManager: PostprocessingManager;
  private clock: Clock;
  private world: World;

  private player: Player;
  private realm: PortfolioRealm;
  private lighting: LightingSystem;
  private environmentalIllumination: Environmentallumination;

  private grass: NewGrass;

  constructor() {
    this.rendererManager = new RendererManager();
    this.sceneManager = new SceneManager(this.rendererManager);
    // this.postprocessingManager = new PostprocessingManager(
    //   this.rendererManager,
    //   this.sceneManager,
    // );
    this.inputManager = new InputManager();
    this.monitoringManager = new MonitoringManager();

    this.clock = new Clock(false);

    this.lighting = new LightingSystem(this.sceneManager.scene);

    this.environmentalIllumination = new Environmentallumination(
      this.sceneManager.scene,
    );

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
      environmentalIllumination: this.environmentalIllumination,
    });

    // Grass
    this.grass = new NewGrass(this.sceneManager.scene);
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
    this.sceneManager.camera.aspect = sizes.aspect;
    this.sceneManager.camera.updateProjectionMatrix();

    // Update renderer
    this.rendererManager.renderer.setSize(sizes.width, sizes.height);
    this.rendererManager.renderer.setPixelRatio(sizes.dpr);
  }

  async startLoop(callback?: (state: State) => void) {
    await this.monitoringManager.stats.init(this.rendererManager.renderer);
    this.clock.start();

    const state: State = {
      clock: this.clock,
      scene: this.sceneManager.scene,
      camera: this.sceneManager.camera,
      inputManager: this.inputManager,
      lighting: this.lighting,
      environmentalIllumination: this.environmentalIllumination,
      world: this.world,
      player: this.player,
      renderer: this.rendererManager.renderer,
    };

    const loop = async () => {
      this.monitoringManager.stats.update();
      this.sceneManager.update();

      callback?.(state);

      this.world.step();
      this.player.update(state);
      this.realm.update(state);
      this.lighting.update(state);
      await this.grass.update(state);
      // // Rread GPU compute time (not working)
      // const computeTime =
      //   await this.rendererManager.renderer.resolveTimestampsAsync("compute");
      // console.log("GPU Compute Time ms:", computeTime);

      // await this.postprocessingManager.composer.renderAsync();
      await this.rendererManager.renderer.renderAsync(
        this.sceneManager.scene,
        this.sceneManager.camera,
      );

      // // Read GPU render time (not working)
      // const renderTime =
      //   await this.rendererManager.renderer.resolveTimestampsAsync("render");
      // console.log("GPU Render Time ms:", renderTime);

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
