import { Mesh } from "three";
import { assets, sound, stage, eventBus, landmarks } from "../../systems";
import { debugWater } from "./waterDebug";
import { WaterMaterial } from "./WaterMaterial";

export class Water {
  private lakeSurface: Mesh;
  private unsubscribeAudioProgress?: VoidFunction;

  constructor() {
    const lakeSurface = assets.getMesh(
      "lake-surface",
      assets.resources.terrainModel,
    );
    this.lakeSurface = lakeSurface;

    lakeSurface.material = new WaterMaterial(lakeSurface.matrixWorld);
    debugWater();

    const { boundingSphere } = lakeSurface.geometry;
    if (!boundingSphere) throw new Error("Lake surface has no bounding sphere");
    boundingSphere.radius *= 0.75;

    stage.waterScene.add(lakeSurface);

    landmarks.register({
      name: "Lake",
      icon: "water",
      position: lakeSurface.position,
      arrivalRadius: 90,
    });

    if (sound.isReady) this.attachLakeAudio();
    else
      this.unsubscribeAudioProgress = eventBus.on(
        "engine-loading-audio-progress",
        this.onAudioProgress,
      );
  }

  private attachLakeAudio() {
    this.lakeSurface.add(sound.lake);
    const { unsubscribeAudioProgress } = this;
    if (unsubscribeAudioProgress) unsubscribeAudioProgress();
    this.unsubscribeAudioProgress = undefined;
  }

  private onAudioProgress = (percentage: number) => {
    if (percentage !== 100) return;
    this.attachLakeAudio();
  };
}
