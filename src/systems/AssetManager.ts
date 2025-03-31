import {
  CubeTexture,
  CubeTextureLoader,
  LinearSRGBColorSpace,
  LoadingManager,
  Texture,
  TextureLoader,
} from "three";
import { GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
// Model
import realmModelUrl from "/models/realm.glb?url";
// Environment
import pxUrl from "/textures/environment/px.webp?url";
import nxUrl from "/textures/environment/nx.webp?url";
import pyUrl from "/textures/environment/py.webp?url";
import nyUrl from "/textures/environment/ny.webp?url";
import pzUrl from "/textures/environment/pz.webp?url";
import nzUrl from "/textures/environment/nz.webp?url";
// Noise
import noiseTextureUrl from "/textures/noise/noise.webp?url";
// Terrain
import terrainTypeTextureUrl from "/textures/realm/terrainType.webp?url";
import sandNorTextureUrl from "/textures/realm/sandNormal.webp?url";
import grassNorTextureUrl from "/textures/realm/grassNormal.webp?url";
import grassDiffTextureUrl from "/textures/realm/grassDiffuse.webp?url";
// Shadowmap
import shadowAoTextureUrl from "/textures/realm/terrainShadowAo.webp?url";
// Water lilies
import waterLiliesTextureUrl from "/textures/realm/waterLiliesDiffuse.webp?url";
import waterLiliesAlphaTextureUrl from "/textures/realm/waterLiliesAlpha.webp?url";
// Stones
import stoneDiffTextureUrl from "/textures/realm/stoneDiffuse.webp?url";
import stoneMossyDiffTextureUrl from "/textures/realm/stoneMossyDiffuse.webp?url";
import stoneNorAoTextureUrl from "/textures/realm/stoneNormalAo.webp?url";
import stoneMossyNorAoTextureUrl from "/textures/realm/stoneMossyNormalAo.webp?url";
// Trees
import barkDiffTextureUrl from "/textures/realm/barkDiffuse.webp?url";
import barkNorTextureUrl from "/textures/realm/barkNormal.webp?url";
import canopyDiffTextureUrl from "/textures/realm/canopyDiffuse.webp?url";
import canopyNorTextureUrl from "/textures/realm/canopyNormal.webp?url";

// // Flowers
// import flowerComposition1TextureUrl from "/textures/realm/flower_composition_1.webp?url";
// import flowerComposition2TextureUrl from "/textures/realm/flower_composition_2.webp?url";

class AssetManager {
  // Loaders
  textureLoader: TextureLoader;
  gltfLoader: GLTFLoader;
  cubeTextureLoader: CubeTextureLoader;

  // Assets
  realmModel!: GLTF;

  noiseTexture!: Texture;

  envMapTexture!: CubeTexture;

  terrainTypeMap!: Texture;
  terrainShadowAo!: Texture;
  grassDiffuse!: Texture;
  sandNormal!: Texture;
  grassNormal!: Texture;

  canopyDiffuse!: Texture;
  canopyNormal!: Texture;
  barkDiffuse!: Texture;
  barkNormal!: Texture;

  stoneDiffuse!: Texture;
  stoneMossyDiffuse!: Texture;
  stoneNormalAo!: Texture;
  stoneMossyNormalAo!: Texture;

  waterLiliesTexture!: Texture;
  waterLiliesAlphaTexture!: Texture;

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
      // Model [0]
      this.gltfLoader.loadAsync(realmModelUrl),
      // Environment [1]
      assetManager.cubeTextureLoader.loadAsync([
        pxUrl, // positive x
        nxUrl, // negative x
        pyUrl, // positive y
        nyUrl, // negative y
        pzUrl, // positive z
        nzUrl, // negative z
      ]),
      // Noise [2]
      this.textureLoader.loadAsync(noiseTextureUrl), // R = Perlin, G = Voronoi, B = Random
      // Terrain [3, 4, 5, 6]
      this.textureLoader.loadAsync(terrainTypeTextureUrl), // R = /, G = Grass, B = Water
      this.textureLoader.loadAsync(grassDiffTextureUrl), // Grass diffuse
      this.textureLoader.loadAsync(grassNorTextureUrl), // Grass normal
      this.textureLoader.loadAsync(sandNorTextureUrl), // Sand normal
      // Shadowmap + AO [7]
      this.textureLoader.loadAsync(shadowAoTextureUrl),
      // Water lilies [8, 9]
      this.textureLoader.loadAsync(waterLiliesTextureUrl), // Water lilies diffuse
      this.textureLoader.loadAsync(waterLiliesAlphaTextureUrl), // Water lilies alpha
      // Stones [10, 11, 12, 13]
      this.textureLoader.loadAsync(stoneDiffTextureUrl),
      this.textureLoader.loadAsync(stoneMossyDiffTextureUrl),
      this.textureLoader.loadAsync(stoneNorAoTextureUrl),
      this.textureLoader.loadAsync(stoneMossyNorAoTextureUrl),
      // Trees [14, 15, 16, 17]
      this.textureLoader.loadAsync(canopyDiffTextureUrl),
      this.textureLoader.loadAsync(canopyNorTextureUrl),
      this.textureLoader.loadAsync(barkDiffTextureUrl),
      this.textureLoader.loadAsync(barkNorTextureUrl),
      // ------ Still testing the ones below ------
    ]);

    // Models
    this.realmModel = res[0];
    // Environment
    this.envMapTexture = res[1];
    this.envMapTexture.generateMipmaps = false;
    // Noise
    this.noiseTexture = res[2];
    // Terain
    this.terrainTypeMap = res[3];
    this.terrainTypeMap.flipY = false;
    this.grassDiffuse = res[4];
    this.grassNormal = res[5];
    this.sandNormal = res[6];
    this.terrainShadowAo = res[7];
    this.terrainShadowAo.colorSpace = LinearSRGBColorSpace;
    this.terrainShadowAo.flipY = false;

    // Water lilies
    this.waterLiliesTexture = res[8];
    this.waterLiliesTexture.flipY = false;
    this.waterLiliesAlphaTexture = res[9];
    this.waterLiliesAlphaTexture.flipY = false;
    this.waterLiliesAlphaTexture.colorSpace = LinearSRGBColorSpace;

    // Rocks
    this.stoneDiffuse = res[10];
    this.stoneMossyDiffuse = res[11];
    this.stoneNormalAo = res[12];
    this.stoneMossyNormalAo = res[13];

    // Trees
    this.canopyDiffuse = res[14];
    this.canopyDiffuse.flipY = false;
    this.canopyNormal = res[15];
    this.canopyNormal.flipY = false;
    this.barkDiffuse = res[16];
    this.barkDiffuse.flipY = false;
    this.barkNormal = res[17];
    this.barkNormal.flipY = false;
  }
}

export const assetManager = new AssetManager();
