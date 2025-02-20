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
import realmModelUrl from "/models/realm.glb?url";
import npcsModelUrl from "/models/npcs.glb?url";
import floorTextureUrl from "/textures/realm/floor.webp?url";
import floorWaterMapTextureUrl from "/textures/realm/water_map.webp?url";
import floorGrassMapTextureUrl from "/textures/realm/grass_map.webp?url";
import fenceTextureUrl from "/textures/realm/fence.webp?url";

// Sand
import sandDiffuseTextureUrl from "/textures/realm/coast_sand_diff.webp?url";
import sandNormalTextureUrl from "/textures/realm/coast_sand_nor.webp?url";
import sandARMTextureUrl from "/textures/realm/coast_sand_arm.webp?url";

// Leaves
import leavesDiffuseTextureUrl from "/textures/realm/grass_diff.jpg?url";
import leavesNormalTextureUrl from "/textures/realm/grass_nor.png?url";
import leavesARMTextureUrl from "/textures/realm/leaves_arm.jpg?url";

// Stone
import stoneDiffuseTextureUrl from "/textures/realm/stone_diff.jpg?url";
import stoneNormalTextureUrl from "/textures/realm/stone_nor.jpg?url";
import stoneARMTextureUrl from "/textures/realm/stone_arm.jpg?url";
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
  realmWaterMap!: Texture;
  realmGrassMap!: Texture;
  fenceTexture!: Texture;

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
      this.textureLoader.loadAsync(floorWaterMapTextureUrl),
      assetManager.textureLoader.loadAsync(floorGrassMapTextureUrl),
      assetManager.textureLoader.loadAsync(fenceTextureUrl),
      assetManager.gltfLoader.loadAsync(npcsModelUrl),

      assetManager.textureLoader.loadAsync(sandDiffuseTextureUrl),
      assetManager.textureLoader.loadAsync(sandNormalTextureUrl),
      assetManager.textureLoader.loadAsync(sandARMTextureUrl),

      assetManager.textureLoader.loadAsync(leavesDiffuseTextureUrl),
      assetManager.textureLoader.loadAsync(leavesNormalTextureUrl),
      assetManager.textureLoader.loadAsync(leavesARMTextureUrl),

      assetManager.textureLoader.loadAsync(stoneDiffuseTextureUrl),
      assetManager.textureLoader.loadAsync(stoneNormalTextureUrl),
      assetManager.textureLoader.loadAsync(stoneARMTextureUrl),
    ]);
    this.perlinNoiseTexture = res[0];
    this.randomNoiseTexture = res[1];
    this.voronoiNoiseTexture = res[2];

    this.environmentMap = res[3];

    this.realmModel = res[4];

    this.realmTexture = res[5];
    this.realmTexture.flipY = false;

    this.realmWaterMap = res[6];
    this.realmWaterMap.flipY = false;

    this.realmGrassMap = res[7];
    this.realmGrassMap.flipY = false;

    this.fenceTexture = res[8];
    this.fenceTexture.flipY = false;

    this.npcsModel = res[9];

    this.sandDiffuseTexture = res[10];
    this.sandNormalTexture = res[11];
    this.sandARMTexture = res[12];

    this.mudDiffuseTexture = res[13];
    this.mudNormalTexture = res[14];
    this.mudARMTexture = res[15];

    this.stoneDiffuseTexture = res[16];
    this.stoneNormalTexture = res[17];
    this.stoneARMTexture = res[18];
  }
}

export const assetManager = new AssetManager();
