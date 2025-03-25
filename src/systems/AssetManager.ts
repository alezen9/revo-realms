import {
  CubeTexture,
  CubeTextureLoader,
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
import terrainTypeTextureUrl from "/textures/realm/terrain_type.webp?url";
import sandNormalTextureUrl from "/textures/realm/sand_nor.webp?url";
import grassDiffTextureUrl from "/textures/realm/grass_diff.webp?url";
import grassNorTextureUrl from "/textures/realm/grass_nor.webp?url";
// Lightmap
import lightmapTextureUrl from "/textures/realm/lightmap.webp?url";
// Water lilies
import waterLiliesTextureUrl from "/textures/realm/water_lilies.webp?url";
import waterLiliesAlphaTextureUrl from "/textures/realm/water_lilies_alpha.webp?url";

// Flowers
import flowerComposition1TextureUrl from "/textures/realm/flower_composition_1.webp?url";
import flowerComposition2TextureUrl from "/textures/realm/flower_composition_2.webp?url";

// Stone
import stoneDifflTextureUrl from "/textures/realm/stone_diff.webp?url";

// Trees
import barkDiffTextureUrl from "/textures/realm/bark_diff.webp?url";
import canopyDiffTextureUrl from "/textures/realm/canopy_diff.webp?url";
import canopyNorTextureUrl from "/textures/realm/canopy_nor.webp?url";

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
  grassDiffTexture!: Texture;
  grassNorTexture!: Texture;
  sandNormalTexture!: Texture;
  lightmapTexture!: Texture;

  waterLiliesTexture!: Texture;
  waterLiliesAlphaTexture!: Texture;

  flowerCompositionTexture_1!: Texture;
  flowerCompositionTexture_2!: Texture;

  stoneDiffTexture!: Texture;

  canopyDiffTexture!: Texture;
  canopyNorTexture!: Texture;
  barkDiffTexture!: Texture;

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
      // Model
      this.gltfLoader.loadAsync(realmModelUrl),
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
      this.textureLoader.loadAsync(noiseTextureUrl), // R = Perlin, G = Voronoi, B = Random
      // Terrain
      this.textureLoader.loadAsync(terrainTypeTextureUrl), // R = /, G = Grass, B = Water
      this.textureLoader.loadAsync(grassDiffTextureUrl), // Grass diffuse
      this.textureLoader.loadAsync(grassNorTextureUrl), // Grass normal
      this.textureLoader.loadAsync(sandNormalTextureUrl), // Sand normal
      // Lightmap
      this.textureLoader.loadAsync(lightmapTextureUrl),
      // Water lilies
      this.textureLoader.loadAsync(waterLiliesTextureUrl), // Water lilies diffuse
      this.textureLoader.loadAsync(waterLiliesAlphaTextureUrl), // Water lilies alpha

      // ------ Still testing the ones below ------

      // Flowers
      this.textureLoader.loadAsync(flowerComposition1TextureUrl), // Flowers diffuse 1
      this.textureLoader.loadAsync(flowerComposition2TextureUrl), // Flowers diffuse 2

      this.textureLoader.loadAsync(stoneDifflTextureUrl),

      this.textureLoader.loadAsync(canopyDiffTextureUrl),
      this.textureLoader.loadAsync(canopyNorTextureUrl),
      this.textureLoader.loadAsync(barkDiffTextureUrl),
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
    this.grassDiffTexture = res[4];
    this.grassDiffTexture.generateMipmaps = false;
    this.sandNormalTexture = res[5];
    this.sandNormalTexture.generateMipmaps = false;
    this.grassNorTexture = res[6];
    this.grassNorTexture.generateMipmaps = false;
    this.lightmapTexture = res[7];
    this.lightmapTexture.flipY = false;
    this.lightmapTexture.generateMipmaps = false;

    this.waterLiliesTexture = res[8];
    this.waterLiliesTexture.flipY = false;
    this.waterLiliesTexture.generateMipmaps = false;
    this.waterLiliesAlphaTexture = res[9];
    this.waterLiliesAlphaTexture.flipY = false;
    this.waterLiliesAlphaTexture.generateMipmaps = false;

    this.flowerCompositionTexture_1 = res[10];
    this.flowerCompositionTexture_2 = res[11];

    this.stoneDiffTexture = res[12];

    this.canopyDiffTexture = res[13];
    this.canopyDiffTexture.flipY = false;
    this.canopyNorTexture = res[14];
    this.canopyNorTexture.flipY = false;
    this.barkDiffTexture = res[15];
    this.barkDiffTexture.flipY = false;
  }
}

export const assetManager = new AssetManager();
