import { TextureLoader } from "three";
import { DRACOLoader, GLTFLoader } from "three/examples/jsm/Addons.js";

export default class AssetManager {
  textureLoader: TextureLoader;
  gltfLoader: GLTFLoader;
  constructor() {
    // Texture
    this.textureLoader = new TextureLoader();

    // GLTF
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);
  }
}
