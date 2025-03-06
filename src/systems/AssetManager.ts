import {
  CubeTexture,
  CubeTextureLoader,
  LoadingManager,
  Texture,
  TextureLoader,
} from "three";
import { DRACOLoader, GLTF, GLTFLoader } from "three/examples/jsm/Addons.js";
// Noise
import perlinNoiseTextureUrl from "/textures/noise/perlin_noise.webp?url";
import randomNoiseTextureUrl from "/textures/noise/random_noise.webp?url";
import voronoiNoiseTextureUrl from "/textures/noise/voronoi_noise.webp?url";
// Realm
import realmModelUrl from "/models/realm.glb?url";
import floorGrassWaterMapTextureUrl from "/textures/realm/water_grass_map.webp?url";

// Sand
import sandNormalTextureUrl from "/textures/realm/sand_nor.webp?url";

// Plant
import leafTextureUrl from "/textures/realm/leaf.webp?url";

// Environment
import pxUrl from "/textures/environment/px.webp?url";
import nxUrl from "/textures/environment/nx.webp?url";
import pyUrl from "/textures/environment/py.webp?url";
import nyUrl from "/textures/environment/ny.webp?url";
import pzUrl from "/textures/environment/pz.webp?url";
import nzUrl from "/textures/environment/nz.webp?url";

class AssetManager {
  textureLoader: TextureLoader;
  gltfLoader: GLTFLoader;
  cubeTextureLoader: CubeTextureLoader;
  // Noise Textures
  perlinNoiseTexture!: Texture;
  randomNoiseTexture!: Texture;
  voronoiNoiseTexture!: Texture;
  // Textures
  envMapTexture!: CubeTexture;
  floorGrassWaterMap!: Texture;

  sandNormalTexture!: Texture;
  leafTexture!: Texture;

  // Models
  npcsModel!: GLTF;
  realmModel!: GLTF;

  constructor() {
    const manager = this.createLoadingManager();

    // Texture
    this.textureLoader = new TextureLoader(manager);

    // GLTF
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath("/revo-realms/draco/");
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
      // Environment
      assetManager.cubeTextureLoader.loadAsync([
        pxUrl, // positive x
        nxUrl, // negative x
        pyUrl, // positive y
        nyUrl, // negative y
        pzUrl, // positive z
        nzUrl, // negative z
      ]),
      // Noise
      this.textureLoader.loadAsync(perlinNoiseTextureUrl),
      this.textureLoader.loadAsync(randomNoiseTextureUrl),
      this.textureLoader.loadAsync(voronoiNoiseTextureUrl),
      // Models
      this.gltfLoader.loadAsync(realmModelUrl),
      // Floor textures
      this.textureLoader.loadAsync(floorGrassWaterMapTextureUrl), // Grass, Water map
      this.textureLoader.loadAsync(sandNormalTextureUrl), // Sand normal
      this.textureLoader.loadAsync(leafTextureUrl), // Leaf diffuse
    ]);
    // Environment
    this.envMapTexture = res[0];
    // Noise
    this.perlinNoiseTexture = res[1];
    this.randomNoiseTexture = res[2];
    this.voronoiNoiseTexture = res[3];
    // Models
    this.realmModel = res[4];
    // Floor textures
    this.floorGrassWaterMap = res[5];
    this.floorGrassWaterMap.flipY = false;

    this.sandNormalTexture = res[6];
    this.leafTexture = res[7];
  }
}

export const assetManager = new AssetManager();
