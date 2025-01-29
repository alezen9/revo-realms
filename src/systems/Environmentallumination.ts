import { State } from "../Game";
import { assetManager } from "./AssetManager";
import pxUrl from "/envwebp/px.webp?url";
import nxUrl from "/envwebp/nx.webp?url";
import pyUrl from "/envwebp/py.webp?url";
import nyUrl from "/envwebp/ny.webp?url";
import pzUrl from "/envwebp/pz.webp?url";
import nzUrl from "/envwebp/nz.webp?url";
import { CubeTexture } from "three";

export default class Environmentallumination {
  environmentMap: CubeTexture;
  constructor(scene: State["scene"]) {
    const environmentMap = assetManager.cubeTextureLoader.load([
      pxUrl, // positive x
      nxUrl, // negative x
      pyUrl, // positive y
      nyUrl, // negative y
      pzUrl, // positive z
      nzUrl, // negative z
    ]);

    scene.background = environmentMap;
    scene.environment = environmentMap;
    this.environmentMap = environmentMap;
  }
}
