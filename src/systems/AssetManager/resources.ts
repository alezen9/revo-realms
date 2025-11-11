import { CompressedTexture, CubeTexture, SRGBColorSpace, Texture } from "three";
import { type GLTF } from "three/addons/loaders/GLTFLoader.js";
// Model
import realmModelUrl from "/models/realm.glb?url"; // old
import worldModelUrl from "/models/world.glb?url"; // new
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
// Berserk
import berserkDiffuseUrl from "/textures/new-world/cool-stuff/berserk/diffuse_1k.ktx2?url";
import berserkNormalRoughnessUrl from "/textures/new-world/cool-stuff/berserk/normalRough_2k.ktx2?url";
// One Piece
import onePieceAtlasUrl from "/textures/realm/onePieceAtlas.webp?url";
// Naruto
import kunaiDiffuseUrl from "/textures/realm/kunaiDiffuse.webp?url";
import kunaiMRUrl from "/textures/realm/kunaiMR.webp?url";
// Campfire
import campfireDiffuseUrl from "/textures/new-world/campfire/diffuse_512_etc1s.ktx2?url";
import campfireNormalUrl from "/textures/new-world/campfire/normal_512.ktx2?url";
// Log
import logNormalUrl from "/textures/new-world/log/normal_1k.ktx2?url";
import logDiffuseUrl from "/textures/new-world/log/diffuse_512.ktx2?url";
// Fire
import fireSpritesUrl from "/textures/new-world/cool-stuff/fire/fireSprites_128_etc1s.ktx2?url";
// Player
import playerDiffuseUrl from "/textures/new-world/player/football/diffuse_512.ktx2?url";
import playerNormalUrl from "/textures/new-world/player/football/normal_512.ktx2?url";
// Leaf
import leafDiffuseUrl from "/textures/realm/leafDiffuse.webp?url";

import uvCheckerUrl from "/textures/new-world/debug/uvChecker_1k_uastc.ktx2?url";
import terrainNormAoUrl from "/textures/new-world/terrain/groundNormalAO_1k.ktx2?url";
import normVeinWaterUrl from "/textures/new-world/water/water_normal_vein_uastc.ktx2?url";
import noiseAtlasUrl from "/textures/new-world/noise/noise_atlas_uastc.ktx2?url";

import grassMapUrl from "/textures/new-world/terrain/grass-map.png?url";

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

  // -----------------------------------------------
  // Berserk
  // -----------------------------------------------
  {
    name: "berserkDiffuse",
    url: berserkDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },
  {
    name: "berserkNormalRoughness",
    url: berserkNormalRoughnessUrl,
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
