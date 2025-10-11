import {
  CubeTextureLoader,
  DataTexture,
  LoadingManager,
  NoColorSpace,
  TextureLoader,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import atlasesCoords from "../../atlases/atlases.json";
import { Atlases } from "../../atlases/types";
import { loadingManager } from "../LoadingManager";
import { manifest, ResourceRaw, ExternalResources } from "./resources";

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
  }

  private getResource = async (resource: ResourceRaw) => {
    switch (resource.type) {
      case "texture":
        return this.textureLoader.loadAsync(resource.url).then((tex) => {
          tex.flipY = resource.flipY ?? true;
          tex.colorSpace = resource.colorSpace ?? NoColorSpace;
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
    const promises = manifest.map((res) => this.getResource(res));
    await Promise.all(promises);
  }
}

export const assetManager = new AssetManager(loadingManager.manager);
