import { LoadingManager as ThreeLoadingManager } from "three";

class LoadingManager {
  manager: ThreeLoadingManager;
  constructor() {
    this.manager = this.createLoadingManager();
  }

  //   private onStartLog(url: string, itemsLoaded: number, itemsTotal: number) {
  //     console.log(
  //       "Started loading file: " +
  //         url +
  //         ".\nLoaded " +
  //         itemsLoaded +
  //         " of " +
  //         itemsTotal +
  //         " files.",
  //     );
  //   }

  //   private onProgressLog(url: string, itemsLoaded: number, itemsTotal: number) {
  //     console.log(
  //       "Loading file: " +
  //         url +
  //         ".\nLoaded " +
  //         itemsLoaded +
  //         " of " +
  //         itemsTotal +
  //         " files.",
  //     );
  //   }

  private onErrorLog(url: string) {
    console.log("There was an error loading " + url);
  }

  //   private onLoadLog() {
  //     console.log("Loading complete!");
  //   }

  private createLoadingManager() {
    const manager = new ThreeLoadingManager();
    manager.onError = this.onErrorLog;
    // manager.onStart = this.onStartLog;
    // manager.onProgress = this.onProgressLog;
    // manager.onLoad = this.onLoadLog;

    return manager;
  }
}

const loadingManager = new LoadingManager();
export default loadingManager;
