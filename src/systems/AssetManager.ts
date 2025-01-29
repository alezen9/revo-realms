import { CubeTextureLoader, Texture, TextureLoader } from "three";
import { DRACOLoader, GLTFLoader } from "three/examples/jsm/Addons.js";
import perlinNoiseTextureUrl from "/textures/perlin_noise.webp?url";
import randomNoiseTextureUrl from "/textures/random_noise.webp?url";

class AssetManager {
  textureLoader: TextureLoader;
  gltfLoader: GLTFLoader;
  cubeTextureLoader: CubeTextureLoader;

  perlinNoiseTexture: Texture;
  randomNoiseTexture: Texture;

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

    // Noise textures
    this.perlinNoiseTexture = this.textureLoader.load(perlinNoiseTextureUrl);
    this.randomNoiseTexture = this.textureLoader.load(randomNoiseTextureUrl);
  }
}

export const assetManager = new AssetManager();
