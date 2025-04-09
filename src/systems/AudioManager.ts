import { Audio, AudioListener, AudioLoader, LoadingManager } from "three";
import ambientUrl from "/audio/ambient.mp3?url";
import { sceneManager } from "./SceneManager";
import loadingManager from "./LoadingManager";

class AudioManager {
  // Loaders
  private audioLoader: AudioLoader;
  private audioListener: AudioListener;

  // State
  isMute = true;
  private files: Audio[] = [];

  ambient!: Audio;

  constructor(manager: LoadingManager) {
    this.audioLoader = new AudioLoader(manager);
    this.audioListener = new AudioListener();
    sceneManager.camera.add(this.audioListener);
  }

  async toggleMute() {
    const context = this.audioListener.context;
    if (context.state === "suspended") await context.resume();
    this.isMute = !this.isMute;
    this.files.forEach((file) => {
      const volume = this.isMute ? 0 : file.userData.originalVolume;
      file.setVolume(volume);
      if (!file.isPlaying) file.play();
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

  async initAsync() {
    const res = await Promise.all([this.audioLoader.loadAsync(ambientUrl)]);

    this.ambient = this.newAudio(res[0], 0.15, true);
  }
}

const audioManager = new AudioManager(loadingManager.manager);
export default audioManager;
