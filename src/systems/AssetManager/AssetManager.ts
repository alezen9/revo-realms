import {
  CubeTextureLoader,
  DataTexture,
  NoColorSpace,
  RepeatWrapping,
  Texture,
  TextureLoader,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import atlasesCoords from "../../atlases/atlases.json";
import { type Atlases } from "../../atlases/types";
import {
  manifest,
  type ResourceRaw,
  type ExternalResources,
} from "./resources";
import { type RendererManager } from "../RendererManager/RendererManager";
import type { EventsManager } from "../EventsManager";

type InternalResources = {
  heightmap: DataTexture;
};

type Resources = ExternalResources & InternalResources;

type FailedLoad = {
  resource: ResourceRaw;
  error: unknown;
};

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 250;

export class AssetManager {
  readonly atlasesCoords = atlasesCoords as Atlases;

  private textureLoader = new TextureLoader();
  private cubeTextureLoader = new CubeTextureLoader();
  private dracoLoader = new DRACOLoader();
  private gltfLoader = new GLTFLoader();
  private ktx2Loader = new KTX2Loader();
  private eventsManager: EventsManager;
  private loadedCount = 0;

  resources = {
    heightmap: new DataTexture(),
  } as Resources;

  constructor(eventsManager: EventsManager) {
    this.eventsManager = eventsManager;
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    this.ktx2Loader.setTranscoderPath("/basis/");
  }

  private loadResource = async (resource: ResourceRaw) => {
    switch (resource.type) {
      case "texture":
      case "ktx2": {
        const loader =
          resource.type === "ktx2" ? this.ktx2Loader : this.textureLoader;
        const texture = await loader.loadAsync(resource.url);
        texture.flipY = resource.flipY ?? true;
        texture.colorSpace = resource.colorSpace ?? NoColorSpace;
        texture.anisotropy = resource.anisotropy ?? Texture.DEFAULT_ANISOTROPY;
        texture.minFilter = resource.minFilter ?? texture.minFilter;
        texture.magFilter = resource.magFilter ?? texture.magFilter;
        texture.generateMipmaps =
          resource.generateMipmaps ?? texture.generateMipmaps;
        if (resource.wrap) texture.wrapS = texture.wrapT = RepeatWrapping;
        this.resources[resource.name] = texture;
        break;
      }
      case "gltf":
        this.resources[resource.name] = await this.gltfLoader.loadAsync(
          resource.url,
        );
        break;
      case "cubeTexture": {
        const cubeTexture = await this.cubeTextureLoader.loadAsync(
          resource.urls,
        );
        cubeTexture.colorSpace = resource.colorSpace ?? NoColorSpace;
        this.resources[resource.name] = cubeTexture;
        break;
      }
      case "binary": {
        const response = await fetch(resource.url);
        if (!response.ok)
          throw new Error(`${resource.url} responded ${response.status}`);
        const buffer = await response.arrayBuffer();
        this.resources[resource.name] = new Uint8Array(buffer);
        break;
      }
    }

    this.loadedCount++;
    const percentage = Math.ceil((this.loadedCount / manifest.length) * 100);
    this.eventsManager.emit("engine-loading-resources-progress", percentage);
  };

  async initAsync(rendererManager: RendererManager) {
    this.ktx2Loader.detectSupport(rendererManager.renderer);

    let pending: ResourceRaw[] = [...manifest];
    let failures: FailedLoad[] = [];

    for (let attempt = 0; pending.length && attempt <= MAX_RETRIES; attempt++) {
      if (attempt) {
        const nominalBackoffMs = RETRY_BACKOFF_MS * 2 ** (attempt - 1);
        const jitteredBackoffMs = nominalBackoffMs * (0.5 + Math.random());
        await new Promise((resolve) => setTimeout(resolve, jitteredBackoffMs));
      }

      failures = [];
      const loads = pending.map((resource) =>
        this.loadResource(resource).catch((error) =>
          failures.push({ resource, error }),
        ),
      );
      await Promise.all(loads);
      pending = failures.map((failure) => failure.resource);
    }

    this.dracoLoader.dispose();
    this.ktx2Loader.dispose();

    if (!failures.length) return;

    const details = failures.map(
      ({ resource, error }) =>
        `${resource.name}: ${error instanceof Error ? error.message : error}`,
    );
    throw new Error(`Failed to load resources -> ${details.join(" | ")}`);
  }
}
