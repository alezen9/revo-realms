import {
  CubeTextureLoader,
  DataTexture,
  Mesh,
  NoColorSpace,
  RepeatWrapping,
  Texture,
  TextureLoader,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import {
  manifest,
  type ResourceRaw,
  type ResourceType,
  type ExternalResources,
} from "./manifest";
import { type Graphics } from "../rendering/Graphics";
import type { EventBus } from "../events/EventBus";

type InternalResources = {
  heightmap: DataTexture;
};

type Resources = ExternalResources & InternalResources;

type LoadedResource = ResourceType[keyof ResourceType] | DataTexture;

type FailedLoad = {
  resource: ResourceRaw;
  error: unknown;
};

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 250;

const hasAllResources = (
  loaded: Record<string, LoadedResource>,
): loaded is Resources => manifest.every(({ name }) => name in loaded);

export class Assets {
  private textureLoader = new TextureLoader();
  private cubeTextureLoader = new CubeTextureLoader();
  private dracoLoader = new DRACOLoader();
  private gltfLoader = new GLTFLoader();
  private ktx2Loader = new KTX2Loader();
  private eventBus: EventBus;
  private loadedCount = 0;
  private loadedResources: Record<string, LoadedResource> = {
    heightmap: new DataTexture(),
  };
  private completeResources?: Resources;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    this.ktx2Loader.setTranscoderPath("/basis/");
  }

  get resources() {
    if (!this.completeResources)
      throw new Error("Resources read before loading finished");
    return this.completeResources;
  }

  getMesh(name: string): Mesh {
    const object = this.resources.worldModel.scene.getObjectByName(name);
    if (!(object instanceof Mesh))
      throw new Error(`World model has no mesh named "${name}"`);
    return object;
  }

  private loadResource = async (resource: ResourceRaw) => {
    switch (resource.type) {
      case "texture":
      case "ktx2": {
        const loader =
          resource.type === "ktx2" ? this.ktx2Loader : this.textureLoader;
        const texture = await loader.loadAsync(resource.url);
        texture.name = resource.name;
        texture.flipY = resource.flipY ?? true;
        texture.colorSpace = resource.colorSpace ?? NoColorSpace;
        texture.anisotropy = resource.anisotropy ?? Texture.DEFAULT_ANISOTROPY;
        texture.minFilter = resource.minFilter ?? texture.minFilter;
        texture.magFilter = resource.magFilter ?? texture.magFilter;
        texture.generateMipmaps =
          resource.generateMipmaps ?? texture.generateMipmaps;
        if (resource.wrap) texture.wrapS = texture.wrapT = RepeatWrapping;
        this.loadedResources[resource.name] = texture;
        break;
      }
      case "gltf":
        const file = await this.gltfLoader.loadAsync(resource.url);
        this.loadedResources[resource.name] = file;
        break;
      case "cubeTexture": {
        const cubeTexture = await this.cubeTextureLoader.loadAsync(
          resource.urls,
        );
        cubeTexture.name = resource.name;
        cubeTexture.colorSpace = resource.colorSpace ?? NoColorSpace;
        this.loadedResources[resource.name] = cubeTexture;
        break;
      }
      case "binary": {
        const response = await fetch(resource.url);
        if (!response.ok)
          throw new Error(`${resource.url} responded ${response.status}`);
        const buffer = await response.arrayBuffer();
        this.loadedResources[resource.name] = new Uint8Array(buffer);
        break;
      }
    }

    this.loadedCount++;
    const percentage = Math.ceil((this.loadedCount / manifest.length) * 100);
    this.eventBus.emit("engine-loading-resources-progress", percentage);
  };

  async initAsync(graphics: Graphics) {
    this.ktx2Loader.detectSupport(graphics.renderer);

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

    if (failures.length) {
      const details = failures.map(
        ({ resource, error }) =>
          `${resource.name}: ${error instanceof Error ? error.message : error}`,
      );
      throw new Error(`Failed to load resources -> ${details.join(" | ")}`);
    }

    if (!hasAllResources(this.loadedResources))
      throw new Error("Loaded resources do not match the manifest");
    this.completeResources = this.loadedResources;
  }
}
