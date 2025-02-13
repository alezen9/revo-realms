import { CubeTextureLoader, Texture, TextureLoader } from "three";
import { DRACOLoader, GLTF, GLTFLoader } from "three/examples/jsm/Addons.js";
// Noise
import perlinNoiseTextureUrl from "/textures/perlin_noise.webp?url";
import randomNoiseTextureUrl from "/textures/random_noise.webp?url";
import voronoiNoiseTextureUrl from "/textures/voronoi_noise.webp?url";
// Realm
import realmModelUrl from "/models/world.glb?url";
import floorTextureUrl from "/textures/realm/floor.webp?url";
import floorCausticsMapTextureUrl from "/textures/realm/caustics.webp?url";

class AssetManager {
  textureLoader: TextureLoader;
  gltfLoader: GLTFLoader;
  cubeTextureLoader: CubeTextureLoader;
  // Noise
  perlinNoiseTexture!: Texture;
  randomNoiseTexture!: Texture;
  voronoiNoiseTexture!: Texture;
  // Realm
  realmModel!: GLTF;
  realmTexture!: Texture;
  realmCausticsMap!: Texture;

  constructor() {
    // Texture
    this.textureLoader = new TextureLoader();

    // GLTF
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);

    // Env maps
    this.cubeTextureLoader = new CubeTextureLoader();
  }

  async initAsync() {
    const res = await Promise.all([
      // Noise
      this.textureLoader.loadAsync(perlinNoiseTextureUrl),
      this.textureLoader.loadAsync(randomNoiseTextureUrl),
      this.textureLoader.loadAsync(voronoiNoiseTextureUrl),
      // Realm
      this.gltfLoader.loadAsync(realmModelUrl),
      this.textureLoader.loadAsync(floorTextureUrl),
      this.textureLoader.loadAsync(floorCausticsMapTextureUrl),
    ]);
    this.perlinNoiseTexture = res[0];
    this.randomNoiseTexture = res[1];
    this.voronoiNoiseTexture = res[2];
    this.realmModel = res[3];
    this.realmTexture = res[4];
    this.realmTexture.flipY = false;
    this.realmCausticsMap = res[5];
    this.realmCausticsMap.flipY = false;
  }
}

export const assetManager = new AssetManager();
