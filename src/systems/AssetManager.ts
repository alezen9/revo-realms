import {
  CubeTexture,
  CubeTextureLoader,
  LoadingManager,
  Texture,
  TextureLoader,
} from "three";
import { GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
// Noise
import noiseTextureUrl from "/textures/noise/noise.webp?url";
// Realm
import realmModelUrl from "/models/realm.glb?url";
import floorGrassWaterMapTextureUrl from "/textures/realm/water_grass_map.webp?url";

// Sand
import sandNormalTextureUrl from "/textures/realm/sand_nor.webp?url";

// Plant
import leafTextureUrl from "/textures/realm/leaf.webp?url";
import waterLiliesTextureUrl from "/textures/realm/water_lilies.webp?url";
import waterLiliesAlphaTextureUrl from "/textures/realm/water_lilies_alpha.webp?url";

// Grass
import grassDiffTextureUrl from "/textures/realm/grass_diff.webp?url";
import grassNorTextureUrl from "/textures/realm/grass_nor.webp?url";

// Flowers
import flowerComposition1TextureUrl from "/textures/realm/flower_composition_1.webp?url";
import flowerComposition2TextureUrl from "/textures/realm/flower_composition_2.webp?url";

// Lightmap
import lightmapTextureUrl from "/textures/realm/lightmap.webp?url";

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
  // Textures
  noiseTexture!: Texture;
  envMapTexture!: CubeTexture;
  floorGrassWaterMap!: Texture;

  sandNormalTexture!: Texture;
  leafTexture!: Texture;
  waterLiliesTexture!: Texture;
  waterLiliesAlphaTexture!: Texture;

  grassDiffTexture!: Texture;
  grassNorTexture!: Texture;

  flowerCompositionTexture_1!: Texture;
  flowerCompositionTexture_2!: Texture;

  lightmapTexture!: Texture;

  // Models
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
      this.textureLoader.loadAsync(noiseTextureUrl), // R = Perlin, G = Voronoi, B = Random
      // Models
      this.gltfLoader.loadAsync(realmModelUrl),
      // Floor textures
      this.textureLoader.loadAsync(floorGrassWaterMapTextureUrl), // Grass, Water map
      this.textureLoader.loadAsync(sandNormalTextureUrl), // Sand normal
      this.textureLoader.loadAsync(leafTextureUrl), // Leaf diffuse
      this.textureLoader.loadAsync(waterLiliesTextureUrl), // Water lilies diffuse
      this.textureLoader.loadAsync(waterLiliesAlphaTextureUrl), // Water lilies alpha

      this.textureLoader.loadAsync(grassDiffTextureUrl), // Grass diffuse
      this.textureLoader.loadAsync(grassNorTextureUrl), // Grass normal

      this.textureLoader.loadAsync(flowerComposition1TextureUrl), // Flowers diffuse 1
      this.textureLoader.loadAsync(flowerComposition2TextureUrl), // Flowers diffuse 2

      this.textureLoader.loadAsync(lightmapTextureUrl), // Lightmap
    ]);
    // Environment
    this.envMapTexture = res[0];
    // Noise
    this.noiseTexture = res[1];
    // Models
    this.realmModel = res[2];
    // Floor textures
    this.floorGrassWaterMap = res[3];
    this.floorGrassWaterMap.flipY = false;

    this.sandNormalTexture = res[4];

    this.leafTexture = res[5];
    this.waterLiliesTexture = res[6];
    this.waterLiliesTexture.flipY = false;
    this.waterLiliesTexture.generateMipmaps = false;
    this.waterLiliesAlphaTexture = res[7];
    this.waterLiliesAlphaTexture.flipY = false;
    this.waterLiliesAlphaTexture.generateMipmaps = false;

    this.grassDiffTexture = res[8];
    this.grassDiffTexture.generateMipmaps = false;
    this.grassNorTexture = res[9];
    this.grassNorTexture.generateMipmaps = false;

    this.flowerCompositionTexture_1 = res[10];
    this.flowerCompositionTexture_2 = res[11];

    this.lightmapTexture = res[12];
    this.lightmapTexture.flipY = false;
    this.lightmapTexture.generateMipmaps = false;
  }
}

export const assetManager = new AssetManager();
