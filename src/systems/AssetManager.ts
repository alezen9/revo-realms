import {
  CubeTextureLoader,
  RepeatWrapping,
  Texture,
  TextureLoader,
} from "three";
import { DRACOLoader, GLTFLoader } from "three/examples/jsm/Addons.js";
import perlinNoiseTextureUrl from "/perlin_noise_texture.webp?url";
import voronoiNoiseTextureUrl from "/voronoi_noise_texture.webp?url";
import randomNoiseTextureUrl from "/noise.webp?url";
import combinedNoiseTextureUrl from "/combined_noise_texture.webp?url";
import fractalNoiseTextureUrl from "/fractal_noise_texture.webp?url";

class AssetManager {
  textureLoader: TextureLoader;
  gltfLoader: GLTFLoader;
  cubeTextureLoader: CubeTextureLoader;

  perlinNoiseTexture: Texture;
  fractalNoiseTexture: Texture;
  voronoiPerlinNoiseTexture: Texture;
  randoNoiseTexture: Texture;

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
    this.fractalNoiseTexture = this.textureLoader.load(fractalNoiseTextureUrl);
    this.voronoiPerlinNoiseTexture = this.textureLoader.load(
      combinedNoiseTextureUrl,
    );
    this.randoNoiseTexture = this.textureLoader.load(randomNoiseTextureUrl);
  }
}

export const assetManager = new AssetManager();
