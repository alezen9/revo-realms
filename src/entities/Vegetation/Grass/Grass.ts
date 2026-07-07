import { InstancedMesh, Vector2 } from "three";
import { type State } from "../../../Game";
import {
  sceneManager,
  rendererManager,
  lightingManager,
  eventsManager,
} from "../../../systems";
import { config, uniforms } from "./config";
import { debugGrass } from "./debug";
import { GrassBladeGeometry } from "./GrassBladeGeometry";
import { GrassMaterial } from "./GrassMaterial";
import { GrassSsbo } from "./GrassSsbo";

export default class Grass {
  private ssbo = new GrassSsbo();
  private mesh: InstancedMesh;
  private pendingPlayerDeltaXZ = new Vector2(0, 0);
  private computePlayerDeltaXZ = new Vector2(0, 0);
  private isComputeInFlight = false;

  constructor() {
    uniforms.uSunDir.value.copy(lightingManager.sunDirection);
    this.mesh = this.createMesh();
    sceneManager.scene.add(this.mesh);

    eventsManager.on("engine-render-update", this.onEngineUpdate);
    debugGrass(uniforms, config);
  }

  private createMesh() {
    const geometry = new GrassBladeGeometry({
      nSegments: config.SEGMENTS,
      bladeHeight: config.BLADE_HEIGHT,
      bladeWidth: config.BLADE_WIDTH,
    });
    const material = new GrassMaterial(this.ssbo);
    const mesh = new InstancedMesh(geometry, material, config.COUNT);
    mesh.frustumCulled = false;
    return mesh;
  }

  private onEngineUpdate = ({ player }: State) => {
    this.accumulatePlayerDelta(player);
    this.syncPlayerAndCameraUniforms(player);
    this.updateSsbo();
    this.mesh.position.copy(player.position).setY(0);
  };

  private accumulatePlayerDelta(player: State["player"]) {
    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    this.pendingPlayerDeltaXZ.x += dx;
    this.pendingPlayerDeltaXZ.y += dz;
  }

  private syncPlayerAndCameraUniforms(player: State["player"]) {
    uniforms.uPlayerPosition.value.copy(player.position);
    uniforms.uPlayerRadius.value = player.radius;

    const projectionMatrix = sceneManager.playerCamera.projectionMatrix;
    uniforms.uFx.value = projectionMatrix.elements[0];
    uniforms.uFy.value = projectionMatrix.elements[5];
    uniforms.uCameraMatrix.value
      .copy(projectionMatrix)
      .multiply(sceneManager.playerCamera.matrixWorldInverse);
    sceneManager.playerCamera.getWorldDirection(uniforms.uCameraForward.value);
  }

  private updateSsbo() {
    if (this.isComputeInFlight) return;

    this.computePlayerDeltaXZ.copy(this.pendingPlayerDeltaXZ);
    this.pendingPlayerDeltaXZ.set(0, 0);
    uniforms.uPlayerDeltaXZ.value.copy(this.computePlayerDeltaXZ);

    this.isComputeInFlight = true;
    rendererManager.renderer
      .computeAsync(this.ssbo.computeUpdate)
      .catch((error) => {
        console.error("[Grass] computeAsync failed:", error);
        this.pendingPlayerDeltaXZ.add(this.computePlayerDeltaXZ);
      })
      .finally(() => {
        this.isComputeInFlight = false;
      });
  }
}
