import {
  CubeTextureLoader,
  DataTexture,
  LoadingManager,
  NoColorSpace,
  RepeatWrapping,
  Texture,
  TextureLoader,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import atlasesCoords from "../../atlases/atlases.json";
import { Atlases } from "../../atlases/types";
import { loadingManager } from "../LoadingManager";
import { manifest, ResourceRaw, ExternalResources } from "./resources";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { rendererManager } from "../RendererManager";

type InternalResources = {
  terrainHeightMap: DataTexture;
};

type Resources = ExternalResources & InternalResources;

class AssetManager {
  // Atlas coords
  readonly atlasesCoords = atlasesCoords as Atlases;

  // Loaders
  private textureLoader: TextureLoader;
  private gltfLoader: GLTFLoader;
  private cubeTextureLoader: CubeTextureLoader;
  private ktx2Loader: KTX2Loader;

  resources = {
    terrainHeightMap: new DataTexture(), // placeholder
  } as Resources;

  constructor(manager: LoadingManager) {
    // Texture
    this.textureLoader = new TextureLoader(manager);

    // GLTF
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    this.gltfLoader = new GLTFLoader(manager);
    this.gltfLoader.setDRACOLoader(dracoLoader);

    // Env maps
    this.cubeTextureLoader = new CubeTextureLoader(manager);

    // KTX2
    const ktx2Loader = new KTX2Loader(manager);
    ktx2Loader.setTranscoderPath("/basis/");
    this.ktx2Loader = ktx2Loader;
  }

  private getResource = async (resource: ResourceRaw) => {
    switch (resource.type) {
      case "texture":
      case "ktx2":
        const loader =
          resource.type === "ktx2" ? this.ktx2Loader : this.textureLoader;
        return loader.loadAsync(resource.url).then((tex) => {
          tex.flipY = resource.flipY ?? true;
          tex.colorSpace = resource.colorSpace ?? NoColorSpace;
          if (resource.wrap) tex.wrapS = tex.wrapT = RepeatWrapping;
          tex.anisotropy = resource.anisotropy ?? Texture.DEFAULT_ANISOTROPY;
          // @ts-ignore
          this.resources[resource.name] = tex;
        });
      case "gltf":
        return this.gltfLoader.loadAsync(resource.url).then((gltf) => {
          // @ts-ignore
          this.resources[resource.name] = gltf;
        });
      case "cubeTexture":
        return this.cubeTextureLoader
          .loadAsync(resource.urls)
          .then((cubeTex) => {
            cubeTex.colorSpace = resource.colorSpace ?? NoColorSpace;
            // @ts-ignore
            this.resources[resource.name] = cubeTex;
          });
      default:
        throw new Error(`Unsupported resource type: ${(resource as any).type}`);
    }
  };

  async initAsync() {
    await this.ktx2Loader.detectSupportAsync(rendererManager.renderer);
    const promises = manifest.map((res) => this.getResource(res));
    await Promise.all(promises);
  }
}

export const assetManager = new AssetManager(loadingManager.manager);
