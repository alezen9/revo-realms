import {
  CubeTexture,
  CubeTextureLoader,
  LoadingManager,
  Texture,
  TextureLoader,
} from "three";
import { DRACOLoader, GLTF, GLTFLoader } from "three/examples/jsm/Addons.js";
// Noise
import perlinNoiseTextureUrl from "/textures/perlin_noise.webp?url";
import randomNoiseTextureUrl from "/textures/random_noise.webp?url";
import voronoiNoiseTextureUrl from "/textures/voronoi_noise.webp?url";
// Realm
import realmModelUrl from "/models/world.glb?url";
import floorTextureUrl from "/textures/realm/floor.webp?url";
import floorCausticsMapTextureUrl from "/textures/realm/caustics_map.webp?url";
import floorGrassMapTextureUrl from "/textures/realm/grass_map.webp?url";
// Environment
import pxUrl from "/environment/px.webp?url";
import nxUrl from "/environment/nx.webp?url";
import pyUrl from "/environment/py.webp?url";
import nyUrl from "/environment/ny.webp?url";
import pzUrl from "/environment/pz.webp?url";
import nzUrl from "/environment/nz.webp?url";

class AssetManager {
  manager: LoadingManager;
  textureLoader: TextureLoader;
  gltfLoader: GLTFLoader;
  cubeTextureLoader: CubeTextureLoader;
  // Noise
  perlinNoiseTexture!: Texture;
  randomNoiseTexture!: Texture;
  voronoiNoiseTexture!: Texture;
  // Realm
  environmentMap!: CubeTexture;
  realmModel!: GLTF;
  realmTexture!: Texture;
  realmCausticsMap!: Texture;
  realmGrassMap!: Texture;

  constructor() {
    this.manager = this.createLoadingManager();

    // Texture
    this.textureLoader = new TextureLoader(this.manager);

    // GLTF
    const dracoLoader = new DRACOLoader(this.manager);
    dracoLoader.setDecoderPath("/draco/");
    this.gltfLoader = new GLTFLoader(this.manager);
    this.gltfLoader.setDRACOLoader(dracoLoader);

    // Env maps
    this.cubeTextureLoader = new CubeTextureLoader(this.manager);
  }

  private createLoadingManager() {
    const manager = new LoadingManager();
    manager.onStart = function (url, itemsLoaded, itemsTotal) {
      console.log(
        "Started loading file: " +
          url +
          ".\nLoaded " +
          itemsLoaded +
          " of " +
          itemsTotal +
          " files.",
      );
    };

    manager.onLoad = function () {
      console.log("Loading complete!");
    };

    manager.onProgress = function (url, itemsLoaded, itemsTotal) {
      console.log(
        "Loading file: " +
          url +
          ".\nLoaded " +
          itemsLoaded +
          " of " +
          itemsTotal +
          " files.",
      );
    };

    manager.onError = function (url) {
      console.log("There was an error loading " + url);
    };
    return manager;
  }

  async initAsync() {
    const res = await Promise.all([
      // Noise
      this.textureLoader.loadAsync(perlinNoiseTextureUrl),
      this.textureLoader.loadAsync(randomNoiseTextureUrl),
      this.textureLoader.loadAsync(voronoiNoiseTextureUrl),
      // Realm
      this.gltfLoader.loadAsync(realmModelUrl),
      this.textureLoader.loadAsync(floorTextureUrl),
      this.textureLoader.loadAsync(floorCausticsMapTextureUrl),
      assetManager.textureLoader.loadAsync(floorGrassMapTextureUrl),
      assetManager.cubeTextureLoader.loadAsync([
        pxUrl, // positive x
        nxUrl, // negative x
        pyUrl, // positive y
        nyUrl, // negative y
        pzUrl, // positive z
        nzUrl, // negative z
      ]),
    ]);
    this.perlinNoiseTexture = res[0];
    this.randomNoiseTexture = res[1];
    this.voronoiNoiseTexture = res[2];
    this.realmModel = res[3];
    this.realmTexture = res[4];
    this.realmTexture.flipY = false;
    this.realmCausticsMap = res[5];
    this.realmCausticsMap.flipY = false;
    this.realmGrassMap = res[6];
    this.realmGrassMap.flipY = false;
    this.environmentMap = res[7];
  }
}

export const assetManager = new AssetManager();
