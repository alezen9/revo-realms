import {
  CompressedTexture,
  CubeTexture,
  LinearFilter,
  SRGBColorSpace,
  Texture,
  type MagnificationTextureFilter,
  type MinificationTextureFilter,
} from "three";
import { type GLTF } from "three/addons/loaders/GLTFLoader.js";
// Model
import worldModelUrl from "/models/sekai.glb?url"; // new
// Environment
import pxUrl from "/textures/environment/px.webp?url";
import nxUrl from "/textures/environment/nx.webp?url";
import pyUrl from "/textures/environment/py.webp?url";
import nyUrl from "/textures/environment/ny.webp?url";
import pzUrl from "/textures/environment/pz.webp?url";
import nzUrl from "/textures/environment/nz.webp?url";

// Water
import waterNormalUrl from "/textures/new-world/water/water_normal.ktx2?url";
// God of War
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
// Campfire
import campfireDiffuseUrl from "/textures/new-world/campfire/diffuse_2k.ktx2?url";
import campfireNormalRoughnessUrl from "/textures/new-world/campfire/normalRoughness_1k.ktx2?url";
// Fire
import fireSpritesUrl from "/textures/new-world/fire/fireSprites_128_etc1s.ktx2?url";
// Player
import playerDiffuseUrl from "/textures/new-world/player/football/diffuse_512.ktx2?url";
import playerNormalUrl from "/textures/new-world/player/football/normal_512.ktx2?url";
// Flowers
import edelweissUrl from "/textures/new-world/flowers/edelweiss_128.ktx2?url";
// Pine Tree
import pineTreeDiffuseUrl from "/textures/new-world/pine-tree/diffuse_2k.ktx2?url";

// Tree
import _treeCanopyDiffuseUrl from "/textures/new-world/tree/canopy_diffuse_512_uastc.ktx2?url";
import _treeCanopyNormalUrl from "/textures/new-world/tree/canopy_normal_512_uastc.ktx2?url";
import _treeBarkDiffuseUrl from "/textures/new-world/tree/bark_diffuse_512_uastc.ktx2?url";
import _treeBarkNormalUrl from "/textures/new-world/tree/bark_normal_512_uastc.ktx2?url";

import uvCheckerUrl from "/textures/new-world/debug/uvChecker_1k_uastc.ktx2?url";
import terrainNormAoUrl from "/textures/new-world/terrain/groundNormalAO_1k.ktx2?url";
import normVeinWaterUrl from "/textures/new-world/water/water_normal_vein_uastc.ktx2?url";
import noiseAtlasUrl from "/textures/new-world/noise/noise_atlas.ktx2?url";

// dev
// import grassMapUrl from "/textures/new-world/terrain/grass-map.png?url";
// import waterMapUrl from "/textures/new-world/terrain/water-map.png?url";
// import shadowMapUrl from "/textures/new-world/terrain/shadow-map.png?url";

// prod
import grassMapUrl from "/textures/new-world/terrain/grass-map.png?url";
import waterMapUrl from "/textures/new-world/terrain/water-map.webp?url";
import shadowMapUrl from "/textures/new-world/terrain/shadow-map.webp?url";

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
  minFilter?: MinificationTextureFilter;
  magFilter?: MagnificationTextureFilter;
  generateMipmaps?: boolean;
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

const isDev = import.meta.env.DEV;

export const manifest = [
  // -----------------------------------------------
  // Core
  // -----------------------------------------------
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
  ...(isDev
    ? ([
        {
          name: "uvChecker", // only for debug
          url: uvCheckerUrl,
          type: "ktx2",
          wrap: true,
          colorSpace: SRGBColorSpace,
        },
      ] as const)
    : []),

  // -----------------------------------------------
  // Terrain
  // -----------------------------------------------
  {
    name: "grassMap",
    url: grassMapUrl,
    type: "texture",
    flipY: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
  },
  {
    name: "waterMap",
    url: waterMapUrl,
    type: "texture",
    flipY: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
  },
  {
    name: "shadowMap",
    url: shadowMapUrl,
    type: "texture",
    flipY: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
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
  { name: "waterNormal", url: waterNormalUrl, type: "ktx2" },

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
    name: "campfireNormalRoughness",
    url: campfireNormalRoughnessUrl,
    type: "ktx2",
    flipY: false,
  },

  // -----------------------------------------------
  // Fire
  // -----------------------------------------------
  { name: "fireSprites", url: fireSpritesUrl, type: "ktx2" },

  // -----------------------------------------------
  // God of War
  // -----------------------------------------------
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
  // {
  //   name: "treeCanopyDiffuse",
  //   url: _treeCanopyDiffuseUrl,
  //   type: "ktx2",
  //   flipY: false,
  //   colorSpace: SRGBColorSpace,
  // },
  {
    name: "treeBarkNormal",
    url: _treeBarkNormalUrl,
    type: "ktx2",
    flipY: false,
    wrap: true,
  },
  // {
  //   name: "treeCanopyNormal",
  //   url: _treeCanopyNormalUrl,
  //   type: "ktx2",
  //   flipY: false,
  // },

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

  // -----------------------------------------------
  // Flowers
  // -----------------------------------------------
  {
    name: "edelweiss",
    url: edelweissUrl,
    type: "ktx2",
    colorSpace: SRGBColorSpace,
  },
] as const satisfies ResourceRaw[];

export type ExternalResources = {
  [R in (typeof manifest)[number] as R["name"]]: ResourceType[R["type"]];
};
