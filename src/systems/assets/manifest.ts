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
import terrainModelUrl from "/models/terrain.glb?url";
import pineModelUrl from "/models/pine.glb?url";
import pinesPlacementsUrl from "/models/pines-placements.bin?url";
import leviathanAxeModelUrl from "/models/leviathan-axe.glb?url";
import dragonSlayerModelUrl from "/models/dragon-slayer.glb?url";
import gokuStatueModelUrl from "/models/goku-statue.glb?url";
import campfireModelUrl from "/models/campfire.glb?url";
import footballModelUrl from "/models/football.glb?url";
import koiModelUrl from "/models/koi.glb?url";
import koiRoutesUrl from "/models/koi-routes.bin?url";
import pampasModelUrl from "/models/pampas.glb?url";
import lakeRocksModelUrl from "/models/lake-rocks.glb?url";
import lakeRocksPlacementsUrl from "/models/lake-rocks-placements.bin?url";
import waterLilyModelUrl from "/models/water-lily.glb?url";
import reedsModelUrl from "/models/reeds.glb?url";
import reedsPlacementsUrl from "/models/reeds-placements.bin?url";
import seaweedModelUrl from "/models/seaweed.glb?url";
import seaweedPlacementsUrl from "/models/seaweed-placements.bin?url";
import expedition33FlagModelUrl from "/models/expedition-33-flag.glb?url";
import pxUrl from "/textures/environment/px.webp?url";
import nxUrl from "/textures/environment/nx.webp?url";
import pyUrl from "/textures/environment/py.webp?url";
import nyUrl from "/textures/environment/ny.webp?url";
import pzUrl from "/textures/environment/pz.webp?url";
import nzUrl from "/textures/environment/nz.webp?url";
import terrainMasksUrl from "/textures/new-world/terrain/terrain-masks.ktx2?url"; // R flowers, G grass, B water, A trees
import waterMaskUrl from "/textures/new-world/terrain/water-mask.bin?url"; // used CPU side
import heightmapDataUrl from "/textures/new-world/terrain/heightmap.bin?url";
import woodChipsNormalAoUrl from "/textures/new-world/terrain/wood-chips-normal-ao.ktx2?url";
import waterNormalVeinUrl from "/textures/new-world/terrain/water-normal-vein.ktx2?url";
import leviathanAxeDiffuseEmissionUrl from "/textures/new-world/leviathan-axe/leviathan-axe-diffuse-emission.ktx2?url";
import leviathanAxeNormalUrl from "/textures/new-world/leviathan-axe/leviathan-axe-normal.ktx2?url";
import leviathanAxeArmUrl from "/textures/new-world/leviathan-axe/leviathan-axe-arm.ktx2?url";
import dragonSlayerDiffuseUrl from "/textures/new-world/dragon-slayer/dragon-slayer-diffuse.ktx2?url";
import dragonSlayerNormalUrl from "/textures/new-world/dragon-slayer/dragon-slayer-normal.ktx2?url";
import dragonSlayerArmUrl from "/textures/new-world/dragon-slayer/dragon-slayer-arm.ktx2?url";
import gokuStatueConcreteDiffuseUrl from "/textures/new-world/goku-statue/goku-statue-concrete-diffuse.ktx2?url";
import gokuStatueConcreteNormalUrl from "/textures/new-world/goku-statue/goku-statue-concrete-normal.ktx2?url";
import expedition33FlagDiffuseUrl from "/textures/new-world/expedition-33-flag/expedition-33-flag-diffuse.ktx2?url";
import campfireDiffuseUrl from "/textures/new-world/campfire/campfire-diffuse.ktx2?url";
import campfireNormalRoughnessUrl from "/textures/new-world/campfire/campfire-normal-roughness.ktx2?url";
import fireSpritesUrl from "/textures/new-world/campfire/fire-sprites.ktx2?url";
import footballDiffuseUrl from "/textures/new-world/football/football-diffuse.ktx2?url";
import footballNormalUrl from "/textures/new-world/football/football-normal.ktx2?url";
import koiRedWhiteDiffuseUrl from "/textures/new-world/koi/koi-red-white-diffuse.ktx2?url";
import koiRedBlackDiffuseUrl from "/textures/new-world/koi/koi-red-black-diffuse.ktx2?url";
import koiGoldDiffuseUrl from "/textures/new-world/koi/koi-gold-diffuse.ktx2?url";
import edelweissUrl from "/textures/new-world/edelweiss/edelweiss-diffuse.ktx2?url";
import lakeRocksDiffuseUrl from "/textures/new-world/lake-rocks/lake-rocks-diffuse.ktx2?url";
import reedsDiffuseUrl from "/textures/new-world/reeds/reeds-diffuse.ktx2?url";
import seaweedDiffuseUrl from "/textures/new-world/seaweed/seaweed-diffuse.ktx2?url";
import waterLilyNormalUrl from "/textures/new-world/water-lily/water-lily-normal.ktx2?url";
import waterLilyDiffuseUrl from "/textures/new-world/water-lily/water-lily-diffuse.ktx2?url";
import pampasDiffuseUrl from "/textures/new-world/pampas/pampas-diffuse.ktx2?url";
import pineCanopyDiffuseUrl from "/textures/new-world/pine/pine-canopy-diffuse.ktx2?url";
import pineBarkDiffuseUrl from "/textures/new-world/pine/pine-bark-diffuse.ktx2?url";
import pineBarkNormalUrl from "/textures/new-world/pine/pine-bark-normal.ktx2?url";
import noiseAtlasUrl from "/textures/new-world/noise/noise-atlas.ktx2?url";

export type ResourceType = {
  texture: Texture;
  gltf: GLTF;
  cubeTexture: CubeTexture;
  ktx2: CompressedTexture;
  binary: Uint8Array;
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

type BinaryResourceRaw = {
  name: string;
  url: string;
  type: "binary";
};

export type ResourceRaw =
  | TextureResourceRaw
  | GLTFResourceRaw
  | CubeTextureResourceRaw
  | CompressedTextureResourceRaw
  | BinaryResourceRaw;

export const manifest = [
  { name: "terrainModel", url: terrainModelUrl, type: "gltf" },
  { name: "pineModel", url: pineModelUrl, type: "gltf" },
  { name: "leviathanAxeModel", url: leviathanAxeModelUrl, type: "gltf" },
  { name: "dragonSlayerModel", url: dragonSlayerModelUrl, type: "gltf" },
  { name: "gokuStatueModel", url: gokuStatueModelUrl, type: "gltf" },
  { name: "campfireModel", url: campfireModelUrl, type: "gltf" },
  { name: "footballModel", url: footballModelUrl, type: "gltf" },
  { name: "koiModel", url: koiModelUrl, type: "gltf" },
  { name: "koiRoutes", url: koiRoutesUrl, type: "binary" },
  { name: "pampasModel", url: pampasModelUrl, type: "gltf" },
  { name: "lakeRocksModel", url: lakeRocksModelUrl, type: "gltf" },
  {
    name: "lakeRocksPlacements",
    url: lakeRocksPlacementsUrl,
    type: "binary",
  },
  { name: "waterLilyModel", url: waterLilyModelUrl, type: "gltf" },
  { name: "reedsModel", url: reedsModelUrl, type: "gltf" },
  { name: "reedsPlacements", url: reedsPlacementsUrl, type: "binary" },
  { name: "seaweedModel", url: seaweedModelUrl, type: "gltf" },
  { name: "seaweedPlacements", url: seaweedPlacementsUrl, type: "binary" },
  {
    name: "expedition33FlagModel",
    url: expedition33FlagModelUrl,
    type: "gltf",
  },
  { name: "pinesPlacements", url: pinesPlacementsUrl, type: "binary" },
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
    name: "terrainMasks",
    url: terrainMasksUrl,
    type: "ktx2",
    flipY: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
  },
  {
    name: "waterMask",
    url: waterMaskUrl,
    type: "binary",
  },
  {
    name: "heightmapData",
    url: heightmapDataUrl,
    type: "binary",
  },
  {
    name: "woodChipsNormalAo",
    url: woodChipsNormalAoUrl,
    type: "ktx2",
    wrap: true,
    anisotropy: 4,
  },
  {
    name: "normVeinWater",
    url: waterNormalVeinUrl,
    type: "ktx2",
    wrap: true,
  },

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

  { name: "fireSprites", url: fireSpritesUrl, type: "ktx2" },

  {
    name: "leviathanAxeDiffuseEmissive",
    url: leviathanAxeDiffuseEmissionUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },
  {
    name: "leviathanAxeNormal",
    url: leviathanAxeNormalUrl,
    type: "ktx2",
    flipY: false,
  },
  {
    name: "leviathanAxeORM",
    url: leviathanAxeArmUrl,
    type: "ktx2",
    flipY: false,
  },

  {
    name: "dragonSlayerSwordDiffuse",
    url: dragonSlayerDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },
  {
    name: "dragonSlayerSwordNormal",
    url: dragonSlayerNormalUrl,
    type: "ktx2",
    flipY: false,
  },
  {
    name: "dragonSlayerSwordARM",
    url: dragonSlayerArmUrl,
    type: "ktx2",
    flipY: false,
  },

  {
    name: "concreteDiffuse",
    url: gokuStatueConcreteDiffuseUrl,
    type: "ktx2",
    flipY: false,
    wrap: true,
    // left linear on purpose, as srgb it reads too vibrant
  },
  {
    name: "concreteNormal",
    url: gokuStatueConcreteNormalUrl,
    type: "ktx2",
    flipY: false,
    wrap: true,
  },

  {
    name: "expedition33FlagDiffuse",
    url: expedition33FlagDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },

  {
    name: "playerDiffuse",
    url: footballDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },

  {
    name: "playerNormal",
    url: footballNormalUrl,
    type: "ktx2",
    flipY: false,
  },

  {
    name: "pineCanopyDiffuse",
    url: pineCanopyDiffuseUrl,
    type: "ktx2",
    flipY: false,
    // left linear on purpose, as srgb it reads too vibrant
  },
  {
    name: "pineBarkDiffuse",
    url: pineBarkDiffuseUrl,
    type: "ktx2",
    flipY: false,
    wrap: true,
    colorSpace: SRGBColorSpace,
  },
  {
    name: "pineBarkNormal",
    url: pineBarkNormalUrl,
    type: "ktx2",
    flipY: false,
    wrap: true,
  },

  {
    name: "lakeRocksDiffuse",
    url: lakeRocksDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
    wrap: true,
  },
  {
    name: "reedsDiffuse",
    url: reedsDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },
  {
    name: "seaweedDiffuse",
    url: seaweedDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },
  {
    name: "waterLilyNormal",
    url: waterLilyNormalUrl,
    type: "ktx2",
    flipY: false,
  },
  {
    name: "waterLilyDiffuse",
    url: waterLilyDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },

  {
    name: "koiRedWhiteDiffuse",
    url: koiRedWhiteDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },
  {
    name: "koiRedBlackDiffuse",
    url: koiRedBlackDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },
  {
    name: "koiGoldDiffuse",
    url: koiGoldDiffuseUrl,
    type: "ktx2",
    flipY: false,
    colorSpace: SRGBColorSpace,
  },

  {
    name: "edelweiss",
    url: edelweissUrl,
    type: "ktx2",
    colorSpace: SRGBColorSpace,
  },
  {
    name: "pampasDiffuse",
    url: pampasDiffuseUrl,
    type: "ktx2",
    colorSpace: SRGBColorSpace,
  },
] as const satisfies ResourceRaw[];

export type ExternalResources = {
  [R in (typeof manifest)[number] as R["name"]]: ResourceType[R["type"]];
};
