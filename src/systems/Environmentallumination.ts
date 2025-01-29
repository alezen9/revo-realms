import { State } from "../Game";
import { assetManager } from "./AssetManager";
import pxUrl from "/environment/px.webp?url";
import nxUrl from "/environment/nx.webp?url";
import pyUrl from "/environment/py.webp?url";
import nyUrl from "/environment/ny.webp?url";
import pzUrl from "/environment/pz.webp?url";
import nzUrl from "/environment/nz.webp?url";
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
