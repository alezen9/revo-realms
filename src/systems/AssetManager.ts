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
import realmModelUrl from "/models/realm2.glb?url";
import floorTextureUrl from "/textures/realm/floor.webp?url";
import floorCausticsMapTextureUrl from "/textures/realm/water_map.webp?url";
import floorGrassMapTextureUrl from "/textures/realm/grass_map.webp?url";
import woodTextureUrl from "/textures/realm/fence.webp?url";
// Environment
import pxUrl from "/environment/px.webp?url";
import nxUrl from "/environment/nx.webp?url";
import pyUrl from "/environment/py.webp?url";
import nyUrl from "/environment/ny.webp?url";
import pzUrl from "/environment/pz.webp?url";
import nzUrl from "/environment/nz.webp?url";

class AssetManager {
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
  woodAoMap!: Texture;
  woodNormalMap!: Texture;
  woodTexture!: Texture;

  constructor() {
    const manager = this.createLoadingManager();

    // Texture
    this.textureLoader = new TextureLoader(manager);

    // GLTF
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath("/draco/");
    this.gltfLoader = new GLTFLoader(manager);
    this.gltfLoader.setDRACOLoader(dracoLoader);

    // Env maps
    this.cubeTextureLoader = new CubeTextureLoader(manager);
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
    // return manager;
    return undefined;
  }

  async initAsync() {
    const res = await Promise.all([
      // Noise
      this.textureLoader.loadAsync(perlinNoiseTextureUrl),
      this.textureLoader.loadAsync(randomNoiseTextureUrl),
      this.textureLoader.loadAsync(voronoiNoiseTextureUrl),
      // Environment
      assetManager.cubeTextureLoader.loadAsync([
        pxUrl, // positive x
        nxUrl, // negative x
        pyUrl, // positive y
        nyUrl, // negative y
        pzUrl, // positive z
        nzUrl, // negative z
      ]),
      // Realm
      this.gltfLoader.loadAsync(realmModelUrl),
      this.textureLoader.loadAsync(floorTextureUrl),
      this.textureLoader.loadAsync(floorCausticsMapTextureUrl),
      assetManager.textureLoader.loadAsync(floorGrassMapTextureUrl),
      assetManager.textureLoader.loadAsync(woodTextureUrl),
    ]);
    this.perlinNoiseTexture = res[0];
    this.randomNoiseTexture = res[1];
    this.voronoiNoiseTexture = res[2];

    this.environmentMap = res[3];

    this.realmModel = res[4];
    this.realmTexture = res[5];
    this.realmTexture.flipY = false;
    this.realmCausticsMap = res[6];
    this.realmCausticsMap.flipY = false;
    this.realmGrassMap = res[7];
    this.realmGrassMap.flipY = false;
    this.woodTexture = res[8];
  }
}

export const assetManager = new AssetManager();
