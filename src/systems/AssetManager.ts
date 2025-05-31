import {
  CubeTexture,
  CubeTextureLoader,
  LoadingManager,
  SRGBColorSpace,
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
import waterNormalUrl from "/textures/realm/waterNormal.webp?url";
// Shadowmap
import shadowAoTextureUrl from "/textures/realm/terrainShadowAo.webp?url";
// Water lilies
import waterLiliesTextureUrl from "/textures/realm/waterLiliesDiffuse.webp?url";
import waterLiliesAlphaTextureUrl from "/textures/realm/waterLiliesAlpha.webp?url";
// Flowers
import flowerAtlasUrl from "/textures/realm/flowerAtlas.webp?url";
// Stones
import stoneAtlasUrl from "/textures/realm/stoneAtlas.webp?url";
// Trees
import barkDiffTextureUrl from "/textures/realm/barkDiffuse.webp?url";
import barkNorTextureUrl from "/textures/realm/barkNormal.webp?url";
import canopyDiffTextureUrl from "/textures/realm/canopyDiffuse.webp?url";
import canopyNorTextureUrl from "/textures/realm/canopyNormal.webp?url";
// God of War
import axeDiffuseUrl from "/textures/realm/axeDiffuse.webp?url";
import axeEmissiveUrl from "/textures/realm/axeEmissive.webp?url";
import trunkDiffuseUrl from "/textures/realm/trunkDiffuse.webp?url";
import trunkNormalUrl from "/textures/realm/trunkNormal.webp?url";
// One Piece
import onePieceAtlasUrl from "/textures/realm/onePieceAtlas.webp?url";
// Naruto
import kunaiDiffuseUrl from "/textures/realm/kunaiDiffuse.webp?url";
import kunaiMRUrl from "/textures/realm/kunaiMR.webp?url";
// Campfire
import campfireDiffuseUrl from "/textures/realm/campfireDiffuse.webp?url";
// Fire
import fireSpritesUrl from "/textures/realm/fireSprites.webp?url";
// Football (Player)
import footballDiffuseUrl from "/textures/realm/footballDiffuse.webp?url";

import atlasesCoords from "../atlases/atlases.json";
import { Atlases } from "../atlases/types";
import { loadingManager } from "./LoadingManager";

class AssetManager {
  // Atlas coords
  readonly atlasesCoords = atlasesCoords as Atlases;

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
  waterNormal!: Texture;

  waterLiliesTexture!: Texture;
  waterLiliesAlphaTexture!: Texture;

  flowerAtlas!: Texture;

  stoneAtlas!: Texture;

  canopyDiffuse!: Texture;
  canopyNormal!: Texture;
  barkDiffuse!: Texture;
  barkNormal!: Texture;

  axeDiffuse!: Texture;
  axeEmissive!: Texture;
  trunkDiffuse!: Texture;
  trunkNormal!: Texture;

  onePieceAtlas!: Texture;

  kunaiDiffuse!: Texture;
  kunaiMR!: Texture;

  campfireDiffuse!: Texture;

  fireSprites!: Texture;

  footballDiffuse!: Texture;

  constructor(manager: LoadingManager) {
    // Texture
    this.textureLoader = new TextureLoader(manager);

    // GLTF
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/revo-realms/draco/");
    this.gltfLoader = new GLTFLoader(manager);
    this.gltfLoader.setDRACOLoader(dracoLoader);

    // Env maps
    this.cubeTextureLoader = new CubeTextureLoader(manager);
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
      // Terrain [3, 4, 5, 6, 7]
      this.textureLoader.loadAsync(terrainTypeTextureUrl), // R = /, G = Grass, B = Water
      this.textureLoader.loadAsync(grassDiffTextureUrl), // Grass diffuse
      this.textureLoader.loadAsync(grassNorTextureUrl), // Grass normal
      this.textureLoader.loadAsync(sandNorTextureUrl), // Sand normal
      this.textureLoader.loadAsync(waterNormalUrl), // Water normal
      // Shadowmap + AO [8]
      this.textureLoader.loadAsync(shadowAoTextureUrl),
      // Water lilies [9, 10]
      this.textureLoader.loadAsync(waterLiliesTextureUrl), // Water lilies diffuse
      this.textureLoader.loadAsync(waterLiliesAlphaTextureUrl), // Water lilies alpha
      // Flowers [11]
      this.textureLoader.loadAsync(flowerAtlasUrl),
      // Stones [12]
      this.textureLoader.loadAsync(stoneAtlasUrl),
      // Trees [13, 14, 15, 16]
      this.textureLoader.loadAsync(canopyDiffTextureUrl),
      this.textureLoader.loadAsync(canopyNorTextureUrl),
      this.textureLoader.loadAsync(barkDiffTextureUrl),
      this.textureLoader.loadAsync(barkNorTextureUrl),
      // God of War [17, 18, 19, 20]
      this.textureLoader.loadAsync(axeDiffuseUrl),
      this.textureLoader.loadAsync(axeEmissiveUrl),
      this.textureLoader.loadAsync(trunkDiffuseUrl),
      this.textureLoader.loadAsync(trunkNormalUrl),
      // One Piece [21]
      this.textureLoader.loadAsync(onePieceAtlasUrl),
      // Naruto [22, 23]
      this.textureLoader.loadAsync(kunaiDiffuseUrl),
      this.textureLoader.loadAsync(kunaiMRUrl),
      // Campfire [24]
      this.textureLoader.loadAsync(campfireDiffuseUrl),
      // Fire [25]
      this.textureLoader.loadAsync(fireSpritesUrl),
      // Football (Player) [26]
      this.textureLoader.loadAsync(footballDiffuseUrl),
      // ------ Still testing the ones below ------
    ]);

    // Models
    this.realmModel = res[0];
    // Environment
    this.envMapTexture = res[1];
    this.envMapTexture.colorSpace = SRGBColorSpace;
    this.envMapTexture.generateMipmaps = false;
    // Noise
    this.noiseTexture = res[2];
    // Terain
    this.terrainTypeMap = res[3];
    this.terrainTypeMap.flipY = false;
    this.grassDiffuse = res[4]; // linear space on purpose
    this.grassNormal = res[5];
    this.sandNormal = res[6];
    this.waterNormal = res[7];
    this.terrainShadowAo = res[8];
    this.terrainShadowAo.flipY = false;

    // Water lilies
    this.waterLiliesTexture = res[9]; // linear space on purpose
    this.waterLiliesTexture.flipY = false;
    this.waterLiliesAlphaTexture = res[10];
    this.waterLiliesAlphaTexture.flipY = false;

    // Flowers
    this.flowerAtlas = res[11]; // linear space on purpose
    this.flowerAtlas.flipY = false;

    // Rocks
    this.stoneAtlas = res[12]; // linear space on purpose, it also includes normals
    this.stoneAtlas.flipY = false;

    // Trees
    this.canopyDiffuse = res[13]; // linear space on purpose
    this.canopyDiffuse.flipY = false;
    this.canopyNormal = res[14];
    this.canopyNormal.flipY = false;
    this.barkDiffuse = res[15];
    this.barkDiffuse.flipY = false;
    this.barkDiffuse.colorSpace = SRGBColorSpace;
    this.barkNormal = res[16];
    this.barkNormal.flipY = false;

    // God of War
    this.axeDiffuse = res[17]; // linear space on purpose
    this.axeDiffuse.flipY = false;
    this.axeEmissive = res[18];
    this.axeEmissive.flipY = false;
    this.trunkDiffuse = res[19];
    this.trunkDiffuse.flipY = false;
    this.trunkDiffuse.colorSpace = SRGBColorSpace;
    this.trunkNormal = res[20];
    this.trunkNormal.flipY = false;

    // One Piece
    this.onePieceAtlas = res[21]; // linear space on purpose
    this.onePieceAtlas.flipY = false;

    // Naruto
    this.kunaiDiffuse = res[22];
    this.kunaiDiffuse.flipY = false;
    this.kunaiDiffuse.colorSpace = SRGBColorSpace;
    this.kunaiMR = res[23];
    this.kunaiMR.flipY = false;

    // Campfire
    this.campfireDiffuse = res[24];
    this.campfireDiffuse.flipY = false;
    this.campfireDiffuse.colorSpace = SRGBColorSpace;

    // Fire
    this.fireSprites = res[25];

    // Football (Player)
    this.footballDiffuse = res[26];
    this.footballDiffuse.colorSpace = SRGBColorSpace;
  }
}

export const assetManager = new AssetManager(loadingManager.manager);
