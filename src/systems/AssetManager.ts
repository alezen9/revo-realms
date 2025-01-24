import { RepeatWrapping, Texture, TextureLoader } from "three";
import { DRACOLoader, GLTFLoader } from "three/examples/jsm/Addons.js";
import perlinNoiseTextureUrl from "/perlin_noise_texture.webp?url";

export default class AssetManager {
  textureLoader: TextureLoader;
  gltfLoader: GLTFLoader;

  perlinNoiseTexture: Texture;

  constructor() {
    // Texture
    this.textureLoader = new TextureLoader();

    // GLTF
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);

    this.perlinNoiseTexture = this.textureLoader.load(perlinNoiseTextureUrl);
    this.perlinNoiseTexture.wrapS = RepeatWrapping;
    this.perlinNoiseTexture.wrapT = RepeatWrapping;
    this.perlinNoiseTexture.needsUpdate = true;
  }
}
