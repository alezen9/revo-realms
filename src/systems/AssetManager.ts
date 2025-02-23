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
import npcsModelUrl from "/models/npcs.glb?url";
import floorTextureUrl from "/textures/realm/floor.webp?url";
import floorGrassWaterMapTextureUrl from "/textures/realm/water_grass_map.webp?url";
import fenceTextureUrl from "/textures/realm/fence.webp?url";

// Sand
import sandDiffuseTextureUrl from "/textures/realm/coast_sand_diff.webp?url";
import sandNormalTextureUrl from "/textures/realm/coast_sand_nor.webp?url";
import sandARMTextureUrl from "/textures/realm/coast_sand_arm.webp?url";

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
  // Noise
  perlinNoiseTexture!: Texture;
  randomNoiseTexture!: Texture;
  voronoiNoiseTexture!: Texture;
  // Realm
  envMapTexture!: CubeTexture;
  realmModel!: GLTF;
  floorTexture!: Texture;
  fenceTexture!: Texture;
  floorGrassWaterMap!: Texture;

  sandDiffuseTexture!: Texture;
  sandNormalTexture!: Texture;
  sandARMTexture!: Texture;

  mudDiffuseTexture!: Texture;
  mudNormalTexture!: Texture;
  mudARMTexture!: Texture;

  stoneDiffuseTexture!: Texture;
  stoneNormalTexture!: Texture;
  stoneARMTexture!: Texture;
  // Npcs
  npcsModel!: GLTF;

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
      this.gltfLoader.loadAsync(npcsModelUrl),
      this.gltfLoader.loadAsync(realmModelUrl),
      // Floor textures
      this.textureLoader.loadAsync(floorTextureUrl), // Map diffuse
      this.textureLoader.loadAsync(floorGrassWaterMapTextureUrl), // Grass, Water map
      this.textureLoader.loadAsync(sandDiffuseTextureUrl), // Sand diffuse
      this.textureLoader.loadAsync(sandNormalTextureUrl), // Sand normal
      this.textureLoader.loadAsync(sandARMTextureUrl), // Sand ARM
      this.textureLoader.loadAsync(fenceTextureUrl), // Fence texture
    ]);
    // Environment
    this.envMapTexture = res[0];
    // Noise
    this.perlinNoiseTexture = res[1];
    this.randomNoiseTexture = res[2];
    this.voronoiNoiseTexture = res[3];
    // Models
    this.npcsModel = res[4];
    this.realmModel = res[5];
    // Floor textures
    this.floorTexture = res[6];
    this.floorTexture.flipY = false;

    this.floorGrassWaterMap = res[7];
    this.floorGrassWaterMap.flipY = false;

    this.sandDiffuseTexture = res[8];
    this.sandNormalTexture = res[9];
    this.sandARMTexture = res[10];

    this.fenceTexture = res[11];
    this.fenceTexture.flipY = false;
  }
}

export const assetManager = new AssetManager();
