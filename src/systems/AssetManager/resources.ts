import { CompressedTexture, CubeTexture, SRGBColorSpace, Texture } from "three";
import { type GLTF } from "three/addons/loaders/GLTFLoader.js";
// Model
import realmModelUrl from "/models/realm.glb?url"; // old
import worldModelUrl from "/models/sekai.glb?url"; // new
// Environment
import pxUrl from "/textures/environment/px.webp?url";
import nxUrl from "/textures/environment/nx.webp?url";
import pyUrl from "/textures/environment/py.webp?url";
import nyUrl from "/textures/environment/ny.webp?url";
import pzUrl from "/textures/environment/pz.webp?url";
import nzUrl from "/textures/environment/nz.webp?url";
// Noise
import noiseUrl from "/textures/noise/noise.webp?url";
// Terrain
import terrainTypeUrl from "/textures/realm/terrainType.webp?url";
import waterNormalUrl from "/textures/realm/waterNormal.webp?url";
// Shadowmap
import terrainShadowAoUrl from "/textures/realm/terrainShadowAo.webp?url";
// Water lilies
import waterLiliesDiffuseUrl from "/textures/realm/waterLiliesDiffuse.webp?url";
import waterLiliesAlphaUrl from "/textures/realm/waterLiliesAlpha.webp?url";
// Flowers
import flowerAtlasUrl from "/textures/new-world/terrain/flowerAtlas.ktx2?url";
// Stones
import stoneAtlasUrl from "/textures/realm/stoneAtlas.webp?url";
// Trees
import treeBarkDiffuseUrl from "/textures/realm/barkDiffuse.webp?url";
import treeBarkNormalUrl from "/textures/realm/barkNormal.webp?url";
import treeCanopyDiffuseUrl from "/textures/realm/canopyDiffuse.webp?url";
import treeCanopyNormalUrl from "/textures/realm/canopyNormal.webp?url";
// God of War
import godOfWarAxeDiffuseUrl from "/textures/new-world/cool-stuff/god-of-war/axe_diff_emissive_1k.ktx2?url";
import godOfWarTrunkDiffuseUrl from "/textures/new-world/cool-stuff/god-of-war/trunk_diffuse_512.ktx2?url";
import godOfWarTrunkNormalUrl from "/textures/new-world/cool-stuff/god-of-war/trunk_normal_512.ktx2?url";

import leviathanDiffuseEmissiveUrl from "/textures/new-world/cool-stuff/leviathan/diffuse_emissive_1k.ktx2?url";
import leviathanNormalUrl from "/textures/new-world/cool-stuff/leviathan/normal_512.ktx2?url";
import leviathanORMUrl from "/textures/new-world/cool-stuff/leviathan/orm_512.ktx2?url";
// Berserk
import berserkDiffuseUrl from "/textures/new-world/cool-stuff/berserk/diffuse_1k.ktx2?url";
import berserkNormalUrl from "/textures/new-world/cool-stuff/berserk/normal_1k.ktx2?url";
import berserkORMUrl from "/textures/new-world/cool-stuff/berserk/orm_512.ktx2?url";
// Dragon Ball
import gokuStatueDiffuseUrl from "/textures/new-world/cool-stuff/dragon-ball/diffuse_1k.ktx2?url";
import gokuStatueNormalUrl from "/textures/new-world/cool-stuff/dragon-ball/normal_1k.ktx2?url";
import gokuStatueARMUrl from "/textures/new-world/cool-stuff/dragon-ball/arm_1k.ktx2?url";
// One Piece
import onePieceAtlasUrl from "/textures/realm/onePieceAtlas.webp?url";
// Naruto
import kunaiDiffuseUrl from "/textures/realm/kunaiDiffuse.webp?url";
import kunaiMRUrl from "/textures/realm/kunaiMR.webp?url";
// Campfire
import campfireDiffuseUrl from "/textures/new-world/campfire/diffuse_1k.ktx2?url";
import campfireNormalUrl from "/textures/new-world/campfire/normal_1k.ktx2?url";
// Log
import logNormalUrl from "/textures/new-world/log/normal_1k.ktx2?url";
import logDiffuseUrl from "/textures/new-world/log/diffuse_512.ktx2?url";
// Fire
import fireSpritesUrl from "/textures/new-world/fire/fireSprites_128_etc1s.ktx2?url";
// Player
import playerDiffuseUrl from "/textures/new-world/player/football/diffuse_512.ktx2?url";
import playerNormalUrl from "/textures/new-world/player/football/normal_512.ktx2?url";
// Leaf
import leafDiffuseUrl from "/textures/realm/leafDiffuse.webp?url";

// Tree
import _treeCanopyDiffuseUrl from "/textures/new-world/tree/canopy_diffuse_512_uastc.ktx2?url";
import _treeCanopyNormalUrl from "/textures/new-world/tree/canopy_normal_512_uastc.ktx2?url";
import _treeBarkDiffuseUrl from "/textures/new-world/tree/bark_diffuse_512_uastc.ktx2?url";
import _treeBarkNormalUrl from "/textures/new-world/tree/bark_normal_512_uastc.ktx2?url";

import uvCheckerUrl from "/textures/new-world/debug/uvChecker_1k_uastc.ktx2?url";
import terrainNormAoUrl from "/textures/new-world/terrain/groundNormalAO_1k.ktx2?url";
import normVeinWaterUrl from "/textures/new-world/water/water_normal_vein_uastc.ktx2?url";
import noiseAtlasUrl from "/textures/new-world/noise/noise_atlas.ktx2?url";

import grassMapUrl from "/textures/new-world/terrain/grass-map.png?url";
import waterMapUrl from "/textures/new-world/terrain/water-map.png?url";
// import lightmapUrl from "/textures/new-world/terrain/lightmap.ktx2?url";
import lightmapUrl from "/textures/new-world/terrain/lightmap.png?url";

// Pine Tree
import pineTreeDiffuseUrl from "/textures/new-world/pine-tree/diffuse_2k.ktx2?url";
// import pineTreeNormalUrl from "/textures/new-world/pine-tree/normal.ktx2?url";
// import pineTreeARMUrl from "/textures/new-world/pine-tree/arm.ktx2?url";

type ResourceType = {
  texture: Texture;
  gltf: GLTF;
  cubeTexture: CubeTexture;
  ktx2: CompressedTexture;
};

type TextureResourceRaw = {
  name: string;
  url: string;
  type: "texture";
  flipY?: boolean;
  colorSpace?: string;
  wrap?: boolean;
  anisotropy?: number;
};

type GLTFResourceRaw = {
  name: string;
  url: string;
  type: "gltf";
};

type CubeTextureResourceRaw = {
  name: string;
  urls: string[];
  type: "cubeTexture";
  colorSpace?: string;
};

type CompressedTextureResourceRaw = Omit<TextureResourceRaw, "type"> & {
  type: "ktx2";
};

export type ResourceRaw =
  | TextureResourceRaw
  | GLTFResourceRaw
  | CubeTextureResourceRaw
  | CompressedTextureResourceRaw;

export const manifest = [
  // -----------------------------------------------
  // Core
  // -----------------------------------------------
  { name: "realmModel", url: realmModelUrl, type: "gltf" }, // old
  { name: "noiseTexture", url: noiseUrl, type: "texture" }, // old
  { name: "worldModel", url: worldModelUrl, type: "gltf" },
  {
    name: "noiseAtlas", // super_noise_low / super_perlin / grainy / cracks
    url: noiseAtlasUrl,
    type: "ktx2",
    wrap: true,
  },
  {
    name: "envMapTexture",
    urls: [pxUrl, nxUrl, pyUrl, nyUrl, pzUrl, nzUrl],
    type: "cubeTexture",
    colorSpace: SRGBColorSpace,
  },
  {
    name: "uvChecker", // only for debug
    url: uvCheckerUrl,
    type: "ktx2",
    wrap: true,
    colorSpace: SRGBColorSpace,
  },

  // -----------------------------------------------
  // Terrain
  // -----------------------------------------------
  {
    name: "grassMap",
    url: grassMapUrl,
    type: "texture",
    flipY: false,
  },
  {
    name: "waterMap",
    url: waterMapUrl,
    type: "texture",
    flipY: false,
  },
  {
    name: "lightmap",
    url: lightmapUrl,
    type: "texture",
    flipY: false,
  },
  {
    name: "terrainNormAo",
    url: terrainNormAoUrl,
    type: "ktx2",
    wrap: true,
    anisotropy: 4,
  },
  {
    name: "normVeinWater",
    url: normVeinWaterUrl,
    type: "ktx2",
    wrap: true,
  },

  // -----------------------------------------------
  // Water
  // -----------------------------------------------
  { name: "waterNormal", url: waterNormalUrl, type: "texture" },

  // -----------------------------------------------
  // Campfire
  // -----------------------------------------------
  {
    name: "campfireDiffuse",
    url: campfireDiffuseUrl,
    flipY: false,
    type: "ktx2",
    colorSpace: SRGBColorSpace,
  },
  {
    name: "campfireNormal",
    url: campfireNormalUrl,
    type: "ktx2",
    flipY: false,
  },

  // -----------------------------------------------
  // Log
  // -----------------------------------------------
  {
    name: "logDiffuse",
    url: logDiffuseUrl,
    type: "ktx2",
    colorSpace: SRGBColorSpace,
  },
  {
    name: "logNormal",
    url: logNormalUrl,
    type: "ktx2",
  },
  // -----------------------------------------------
  // Fire
  // -----------------------------------------------
  { name: "fireSprites", url: fireSpritesUrl, type: "ktx2" },

  // -----------------------------------------------
  // God of War
  // -----------------------------------------------
  {
    name: "godOfWarAxeDiffuse",
    url: godOfWarAxeDiffuseUrl,
    type: "ktx2",
    flipY: false,
  },
  {
    name: "godOfWarTrunkDiffuse",
    url: godOfWarTrunkDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },

  {
    name: "godOfWarTrunkNormal",
    url: godOfWarTrunkNormalUrl,
    type: "ktx2",
    flipY: false,
  },

  {
    name: "leviathanAxeDiffuseEmissive",
    url: leviathanDiffuseEmissiveUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },
  {
    name: "leviathanAxeNormal",
    url: leviathanNormalUrl,
    type: "ktx2",
    flipY: false,
  },
  {
    name: "leviathanAxeORM",
    url: leviathanORMUrl,
    type: "ktx2",
    flipY: false,
  },

  // -----------------------------------------------
  // Berserk
  // -----------------------------------------------
  {
    name: "dragonSlayerSwordDiffuse",
    url: berserkDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },
  {
    name: "dragonSlayerSwordNormal",
    url: berserkNormalUrl,
    type: "ktx2",
    flipY: false,
  },
  {
    name: "dragonSlayerSwordARM",
    url: berserkORMUrl,
    type: "ktx2",
    flipY: false,
  },

  // -----------------------------------------------
  // Dragon Ball
  // -----------------------------------------------
  {
    name: "concreteDiffuse",
    url: gokuStatueDiffuseUrl,
    type: "ktx2",
    flipY: false,
    wrap: true,
    // colorSpace: SRGBColorSpace, // on purpose a bit dimmed, otherwise it's too vibrant
  },
  {
    name: "concreteNormal",
    url: gokuStatueNormalUrl,
    type: "ktx2",
    flipY: false,
    wrap: true,
  },
  {
    name: "gokuStatueARM",
    url: gokuStatueARMUrl,
    type: "ktx2",
    flipY: false,
  },

  // -----------------------------------------------
  // Player
  // -----------------------------------------------
  {
    name: "playerDiffuse",
    url: playerDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },

  {
    name: "playerNormal",
    url: playerNormalUrl,
    type: "ktx2",
    flipY: false,
  },

  // -----------------------------------------------
  // New Tree
  // -----------------------------------------------
  {
    name: "treeBarkDiffuse",
    url: _treeBarkDiffuseUrl,
    type: "ktx2",
    flipY: false,
    wrap: true,
    colorSpace: SRGBColorSpace,
  },
  {
    name: "treeCanopyDiffuse",
    url: _treeCanopyDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },
  {
    name: "treeBarkNormal",
    url: _treeBarkNormalUrl,
    type: "ktx2",
    flipY: false,
    wrap: true,
  },
  {
    name: "treeCanopyNormal",
    url: _treeCanopyNormalUrl,
    type: "ktx2",
    flipY: false,
  },

  // -----------------------------------------------
  // Water lilies
  // -----------------------------------------------
  {
    name: "waterLiliesTexture",
    url: waterLiliesDiffuseUrl,
    type: "texture",
    flipY: false,
  },
  {
    name: "waterLiliesAlphaTexture",
    url: waterLiliesAlphaUrl,
    type: "texture",
    flipY: false,
  },

  // -----------------------------------------------
  // Pine Tree
  // -----------------------------------------------
  {
    name: "pineTreeDiffuse",
    url: pineTreeDiffuseUrl,
    type: "ktx2",
    flipY: false,
    // colorSpace: SRGBColorSpace, // on purpose a bit dimmed, otherwise it's too vibrant
  },
  // {
  //   name: "pineTreeNormal",
  //   url: pineTreeNormalUrl,
  //   type: "ktx2",
  //   flipY: false,
  // },
  // {
  //   name: "pineTreeARM",
  //   url: pineTreeARMUrl,
  //   type: "ktx2",
  //   flipY: false,
  // },

  // -----------------------------------------------
  // Flowers
  // -----------------------------------------------
  {
    name: "flowers",
    url: flowerAtlasUrl,
    type: "ktx2",
    colorSpace: SRGBColorSpace,
  },

  // -----------------------------------------------
  // Stones
  // -----------------------------------------------
  { name: "stoneAtlas", url: stoneAtlasUrl, type: "texture", flipY: false },

  // -----------------------------------------------
  // Trees
  // -----------------------------------------------
  {
    name: "canopyDiffuse",
    url: treeCanopyDiffuseUrl,
    type: "texture",
    flipY: false,
  },
  {
    name: "canopyNormal",
    url: treeCanopyNormalUrl,
    type: "texture",
    flipY: false,
  },
  {
    name: "barkDiffuse",
    url: treeBarkDiffuseUrl,
    type: "texture",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },
  { name: "barkNormal", url: treeBarkNormalUrl, type: "texture", flipY: false },
  // -----------------------------------------------
  // One Piece
  // -----------------------------------------------
  {
    name: "onePieceAtlas",
    url: onePieceAtlasUrl,
    type: "texture",
    flipY: false,
  },

  // -----------------------------------------------
  // Naruto
  // -----------------------------------------------
  {
    name: "kunaiDiffuse",
    url: kunaiDiffuseUrl,
    type: "texture",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },
  { name: "kunaiMR", url: kunaiMRUrl, type: "texture", flipY: false },

  // -----------------------------------------------
  // Leaf
  // -----------------------------------------------
  {
    name: "leafDiffuse",
    url: leafDiffuseUrl,
    type: "texture",
    colorSpace: SRGBColorSpace,
  },

  // -----------------------------------------------
  // Terrain
  // -----------------------------------------------
  {
    name: "terrainTypeTexture",
    url: terrainTypeUrl,
    type: "texture",
    flipY: false,
  },
  {
    name: "terrainShadowAoTexture",
    url: terrainShadowAoUrl,
    type: "texture",
    flipY: false,
  },
] as const satisfies ResourceRaw[];

export type ExternalResources = {
  [R in (typeof manifest)[number] as R["name"]]: ResourceType[R["type"]];
};
