import {
  CameraHelper,
  PerspectiveCamera,
  Scene,
  MOUSE,
  Matrix4,
  Vector3,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { type EventsManager } from "./EventsManager";
import type { DebugManager } from "./DebugManager";
import { playerCameraConfig } from "../entities/Player/PlayerCamera";
import { uniform } from "three/tsl";

export class SceneManager {
  mainScene: Scene;
  waterScene = new Scene();
  playerCamera: PerspectiveCamera;
  renderCamera: PerspectiveCamera;
  private eventsManager: EventsManager;
  private cameraHelper?: CameraHelper;
  private controls?: MapControls;
  private orbitControlsCamera?: PerspectiveCamera;
  readonly uFx = uniform(1);
  readonly uFy = uniform(1);
  readonly uCameraMatrix = uniform(new Matrix4());
  readonly uPlayerCameraPosition = uniform(new Vector3());

  constructor(eventsManager: EventsManager) {
    this.eventsManager = eventsManager;
    // Scene
    const mainScene = new Scene();
    this.mainScene = mainScene;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    // Camera
    const camera = new PerspectiveCamera(45, aspect, 0.5, 150);
    camera.position.set(0, 5, 10);
    this.playerCamera = camera;
    mainScene.add(camera);

    // Default render camera
    this.renderCamera = camera;

    this.eventsManager.on("engine-render-target-resize", (sizes) => {
      this.playerCamera.aspect = sizes.aspect;
      this.syncPlayerCameraProjection();
    });

    this.eventsManager.on("engine-render-update", () => {
      this.uPlayerCameraPosition.value.copy(this.playerCamera.position);
      const projectionMatrix = this.playerCamera.projectionMatrix;
      this.uFx.value = projectionMatrix.elements[0];
      this.uFy.value = projectionMatrix.elements[5];
      this.uCameraMatrix.value
        .copy(projectionMatrix)
        .multiply(this.playerCamera.matrixWorldInverse);
    });
  }

  private debugCameras(debugManager: DebugManager) {
    const { controls, orbitControlsCamera, playerCamera, cameraHelper } = this;
    if (!controls || !orbitControlsCamera || !cameraHelper) return;

    const folder = debugManager.panel.addFolder({
      title: "🎥 Cameras",
      index: 0,
      expanded: false,
    });
    folder
      .addBinding(controls, "enabled", { label: "Enable orbit controls" })
      .on("change", ({ value: isEnabled }) => {
        this.renderCamera = isEnabled ? orbitControlsCamera : playerCamera;
        cameraHelper.visible = isEnabled;
        this.eventsManager.emit("engine-camera-change");
      });

    const player = folder.addFolder({ title: "Player" });
    player
      .addBinding(playerCamera, "near", {
        label: "Near plane",
        min: 0.01,
        max: 5,
        step: 0.01,
      })
      .on("change", this.syncPlayerCameraProjection);
    player
      .addBinding(playerCamera, "far", {
        label: "Far plane",
        min: 20,
        max: 300,
        step: 1,
      })
      .on("change", this.syncPlayerCameraProjection);
    player.addBinding(playerCameraConfig.OFFSET, "y", {
      label: "Camera height",
    });
    player.addBinding(playerCameraConfig.OFFSET, "z", {
      label: "Camera distance",
    });
    player.addBinding(playerCameraConfig, "TARGET_HEIGHT_IN_METERS", {
      label: "Target height",
      min: 0,
      max: 5,
      step: 0.1,
    });
    player.addBinding(
      playerCameraConfig,
      "POSITION_FOLLOW_SPEED_IN_INVERSE_SECONDS",
      { label: "Position follow", min: 1, max: 40, step: 0.5 },
    );
    player.addBinding(
      playerCameraConfig,
      "TARGET_FOLLOW_SPEED_IN_INVERSE_SECONDS",
      { label: "Target follow", min: 1, max: 50, step: 0.5 },
    );
    player.addBinding(
      playerCameraConfig,
      "ROTATION_FOLLOW_SPEED_IN_INVERSE_SECONDS",
      { label: "Rotation follow", min: 1, max: 50, step: 0.5 },
    );

    const orbit = folder.addFolder({ title: "Orbit" });
    orbit
      .addBinding(orbitControlsCamera, "near", {
        label: "Near plane",
        min: 0.01,
        max: 5,
        step: 0.01,
      })
      .on("change", () => orbitControlsCamera.updateProjectionMatrix());
    orbit
      .addBinding(orbitControlsCamera, "far", {
        label: "Far plane",
        min: 100,
        max: 5000,
        step: 10,
      })
      .on("change", () => orbitControlsCamera.updateProjectionMatrix());
    orbit.addBinding(controls, "zoomSpeed", {
      label: "Zoom speed",
      min: 0.1,
      max: 5,
      step: 0.1,
    });
    orbit.addBinding(controls, "panSpeed", {
      label: "Pan speed",
      min: 0.1,
      max: 10,
      step: 0.1,
    });
    orbit.addBinding(controls, "rotateSpeed", {
      label: "Rotate speed",
      min: 0.1,
      max: 3,
      step: 0.1,
    });
    orbit.addBinding(controls, "screenSpacePanning", {
      label: "Screen space panning",
    });
    orbit.addBinding(controls, "dampingFactor", {
      label: "Damping factor",
      min: 0.01,
      max: 0.3,
      step: 0.01,
    });
  }

  init(rendererCanvas: HTMLCanvasElement, debugManager: DebugManager) {
    if (!import.meta.env.DEV) return;
    const cameraHelper = new CameraHelper(this.playerCamera);
    cameraHelper.visible = false;
    this.mainScene.add(cameraHelper);
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
    this.eventsManager.on("engine-render-update", this.updateDebugControls);

    // Debug
    this.debugCameras(debugManager);
  }

  get scenes() {
    return [this.mainScene, this.waterScene];
  }

  private syncPlayerCameraProjection = () => {
    this.playerCamera.updateProjectionMatrix();
    this.cameraHelper?.update();
  };

  private updateDebugControls = () => {
    if (this.controls?.enabled) this.controls.update();
  };
}
