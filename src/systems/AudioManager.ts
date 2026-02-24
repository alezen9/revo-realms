import {
  Audio,
  AudioListener,
  AudioLoader,
  LoadingManager,
  PositionalAudio,
} from "three";

import ambientUrl from "/audio/ambient/ambient.mp3?url";
import lakeUrl from "/audio/ambient/lake.mp3?url";
import hitWoodUrl from "/audio/collisions/hitWood.mp3?url";
import hitStoneUrl from "/audio/collisions/hitStone.mp3?url";
import { type SceneManager } from "./SceneManager";
import type { EventsManager } from "./EventsManager";

export class AudioManager {
  // Loaders
  private audioLoader: AudioLoader;
  private audioListener: AudioListener;
  private eventsManager: EventsManager;

  // State
  isReady = false;
  isMute = true;
  private files: Array<Audio | PositionalAudio> = [];

  ambient!: Audio;
  lake!: PositionalAudio;
  hitWood!: Audio;
  hitStone!: Audio;

  constructor(
    sceneManager: SceneManager,
    eventsManager: EventsManager,
  ) {
    this.eventsManager = eventsManager;
    const manager = new LoadingManager();
    manager.onProgress = (_, itemsLoaded, itemsTotal) => {
      const percentage = Math.ceil((100 / itemsTotal) * itemsLoaded);
      this.eventsManager.emit(
        "engine-loading-audio-progress",
        Math.min(percentage, 99),
      );
    };
    this.audioLoader = new AudioLoader(manager);
    this.audioListener = new AudioListener();
    sceneManager.playerCamera.add(this.audioListener);
  }

  async toggleMute() {
    if (!this.isReady) return;
    const context = this.audioListener.context;
    if (context.state === "suspended") await context.resume();
    this.isMute = !this.isMute;
    this.files.forEach((file) => {
      const volume = this.isMute ? 0 : file.userData.originalVolume;
      file.setVolume(volume);
      if (file.loop && !file.isPlaying) file.play();
    });
  }

  private newAudio(buffer: AudioBuffer, volume = 1, loop = false) {
    const audio = new Audio(this.audioListener);
    audio.setBuffer(buffer);
    audio.setVolume(0);
    audio.setLoop(loop);
    audio.userData.originalVolume = volume;
    this.files.push(audio);
    return audio;
  }

  private newPositionalAudio(
    buffer: AudioBuffer,
    volume = 1,
    loop = false,
    distance = 1,
  ) {
    const audio = new PositionalAudio(this.audioListener);
    audio.setBuffer(buffer);
    audio.setVolume(0);
    audio.setLoop(loop);
    audio.userData.originalVolume = volume;
    audio.setRefDistance(distance);
    this.files.push(audio);
    return audio;
  }

  async initAsync() {
    const res = await Promise.all([
      this.audioLoader.loadAsync(ambientUrl),
      this.audioLoader.loadAsync(lakeUrl),
      this.audioLoader.loadAsync(hitWoodUrl),
      this.audioLoader.loadAsync(hitStoneUrl),
    ]);

    this.ambient = this.newAudio(res[0], 0.05, true);
    this.lake = this.newPositionalAudio(res[1], 1, true, 50);
    this.hitWood = this.newAudio(res[2], 0, false);
    this.hitStone = this.newAudio(res[3], 0, false);

    this.isReady = true;
    this.eventsManager.emit("engine-loading-audio-progress", 100);
  }
}
