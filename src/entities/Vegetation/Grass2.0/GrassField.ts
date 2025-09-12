import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  LOD,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";
import { sceneManager } from "../../../systems/SceneManager";
import {
  float,
  int,
  add,
  sub,
  mul,
  div,
  mod,
  floor,
  step,
  abs,
  vec3,
  uniform,
  vertexIndex,
  color,
  Fn,
} from "three/tsl";
import { State } from "../../../Game";
import { eventsManager } from "../../../systems/EventsManager";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { TextGeometry } from "three/examples/jsm/Addons.js";
import { assetManager } from "../../../systems/AssetManager";

const getConfig = () => {
  const BLADE_WIDTH = 0.075;
  const BLADE_HEIGHT = 1.45;
  const TILE_SIZE = 40;
  const BLADES_PER_SIDE = 100;
  const SEGMENTS = 7; // must be odd
  return {
    BLADE_WIDTH,
    BLADE_HEIGHT,
    BLADE_BOUNDING_SPHERE_RADIUS: BLADE_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    BLADES_PER_SIDE,
    COUNT: BLADES_PER_SIDE * BLADES_PER_SIDE,
    SPACING: TILE_SIZE / BLADES_PER_SIDE,
    SEGMENTS,
  };
};
const config = getConfig();

export default class NewGrass {
  private material = new GrassMaterial();
  private group = new Group();
  private nGrid = 5; // 5x5 grid of tiles
  constructor() {
    // const tile = this.createTile(this.material);
    // this.group.add(tile);

    this.group = this.createGrid();
    sceneManager.scene.add(this.group);

    eventsManager.on("update-throttle-16x", this.followPlayer.bind(this));
  }

  private createGrid() {
    const group = new Group();
    let idx = 0;
    for (let i = 0; i < this.nGrid; i++) {
      for (let j = 0; j < this.nGrid; j++) {
        idx++;
        const tile = this.createPlane();
        tile.position.set(
          (i - Math.floor(this.nGrid / 2)) * config.TILE_SIZE,
          0,
          (j - Math.floor(this.nGrid / 2)) * config.TILE_SIZE,
        );

        // add text geometry label to tile with the incremental index
        const textGeom = new TextGeometry(`${idx}`, {
          font: assetManager.font,
          size: 5,
          depth: 0.2,
          curveSegments: 12,
          bevelEnabled: false,
        });
        textGeom.center();
        textGeom.rotateX(-Math.PI / 2);
        textGeom.translate(0, 0.2, 0);
        const textMaterial = new MeshBasicMaterial({ color: "white" });
        const textMesh = new Mesh(textGeom, textMaterial);
        tile.add(textMesh);

        group.add(tile);
      }
    }
    return group;
  }

  private followPlayer(state: State) {
    const { player } = state;
    const dx = player.position.x - this.group.position.x;
    const dz = player.position.z - this.group.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < config.TILE_SIZE * config.TILE_SIZE) return; // don't move if within 1 tile
    this.group.position.x =
      Math.round(player.position.x / config.TILE_SIZE) * config.TILE_SIZE;
    this.group.position.z =
      Math.round(player.position.z / config.TILE_SIZE) * config.TILE_SIZE;

    this.wrapTiles(dx, dz);
  }

  private wrapTiles(dx: number, dz: number) {
    // move tiles opposite to player movement and wrap around
    this.group.children.forEach((tile) => {
      tile.position.x -= config.TILE_SIZE * Math.sign(dx);
      tile.position.z -= config.TILE_SIZE * Math.sign(dz);
      if (Math.abs(tile.position.x) > (this.nGrid / 2) * config.TILE_SIZE) {
        tile.position.x -=
          Math.sign(tile.position.x) * this.nGrid * config.TILE_SIZE;
      }
      if (Math.abs(tile.position.z) > (this.nGrid / 2) * config.TILE_SIZE) {
        tile.position.z -=
          Math.sign(tile.position.z) * this.nGrid * config.TILE_SIZE;
      }
    });
  }

  private createPlane() {
    const geomHigh = new PlaneGeometry(
      config.TILE_SIZE,
      config.TILE_SIZE,
      (config.BLADES_PER_SIDE - 1) * 9,
      config.BLADES_PER_SIDE - 1,
    );
    geomHigh.rotateX(-Math.PI / 2);
    geomHigh.translate(0, 0.1, 0);

    const geomHMid = new PlaneGeometry(
      config.TILE_SIZE,
      config.TILE_SIZE,
      (config.BLADES_PER_SIDE - 1) * 5,
      config.BLADES_PER_SIDE - 1,
    );
    geomHMid.rotateX(-Math.PI / 2);
    geomHMid.translate(0, 0.1, 0);

    const geomLow = new PlaneGeometry(
      config.TILE_SIZE,
      config.TILE_SIZE,
      (config.BLADES_PER_SIDE - 1) * 3,
      config.BLADES_PER_SIDE - 1,
    );
    geomLow.rotateX(-Math.PI / 2);
    geomLow.translate(0, 0.1, 0);

    const materialHigh = new MeshBasicNodeMaterial({ color: "green" });
    const materialMedium = new MeshBasicNodeMaterial({ color: "orange" });
    const materialLow = new MeshBasicNodeMaterial({ color: "red" });
    const lod = new LOD();
    const meshHigh = new Mesh(geomHigh, materialHigh);
    const meshMedium = new Mesh(geomHMid, materialMedium);
    const meshLow = new Mesh(geomLow, materialLow);
    lod.addLevel(meshHigh, 0);
    lod.addLevel(meshMedium, 50);
    lod.addLevel(meshLow, 75);
    return lod;
  }

  private createGeometry(nSegments: number) {
    const quadRows = (nSegments - 1) / 2; // number of stacked quads
    // const vertexCount = (quadRows + 1) * 2 + 1; // 2 verts per row + 1 tip
    const triangleCount = quadRows * 2 + 1; // 2 per quad + 1 tip
    const indices = new Uint8Array(triangleCount * 3);

    let offset = 0;

    for (let row = 0; row < quadRows; row++) {
      const leftBottom = row * 2;
      const rightBottom = row * 2 + 1;
      const leftTop = (row + 1) * 2;
      const rightTop = (row + 1) * 2 + 1;

      // one quad = two triangles
      indices.set([leftBottom, rightBottom, leftTop], offset);
      offset += 3;
      indices.set([rightBottom, rightTop, leftTop], offset);
      offset += 3;
    }

    if (nSegments % 2 === 1) {
      // tip triangle
      const leftTop = quadRows * 2;
      const rightTop = quadRows * 2 + 1;
      const tip = (quadRows + 1) * 2;
      indices.set([leftTop, rightTop, tip], offset);
    }

    console.log({ indices });

    const geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(indices, 1));
    return geometry;
  }

  private createTile(material: GrassMaterial) {
    const geometry = this.createGeometry(config.SEGMENTS);
    const mesh = new InstancedMesh(geometry, material, config.COUNT);
    return mesh;
  }
}

class GrassMaterial extends MeshBasicNodeMaterial {
  private _uniforms = {
    uTime: uniform(0),
    uSegments: uniform(3),
    uBladeWidth: uniform(config.BLADE_WIDTH),
    uBladeHeight: uniform(config.BLADE_HEIGHT),
    uTileSize: uniform(config.TILE_SIZE),
    uHalfTileSize: uniform(config.TILE_HALF_SIZE),
  };
  constructor() {
    super();
    this.create();
    eventsManager.on("update", this.update.bind(this));
  }

  private computeDiffuse = Fn(() => {
    return color(0x00ff00); // seagreen-ish
  });

  private computeBaseVertexPosition = Fn(() => {
    // aliases
    const segs = this._uniforms.uSegments;
    const bW = this._uniforms.uBladeWidth;
    const bH = this._uniforms.uBladeHeight;

    // quads = (n-1)/2, rows = quads+1, tipIx = 2*rows
    const quads = div(sub(segs, int(1)), int(2));
    const rows = add(quads, int(1));
    const tipIx = mul(rows, int(2));

    // id & tip equality as float mask (branchless)
    const idF = float(vertexIndex);
    const tipF = float(tipIx);
    const isTip = sub(float(1), step(float(0.5), abs(sub(idF, tipF)))); // 1 if id==tipIx else 0

    // row/side
    const rowF = floor(div(idF, float(2))); // floor(id/2)
    const sideI = mod(vertexIndex, int(2)); // 0 or 1
    const sideF = float(sideI);

    // y in [0..1]: yBase = row/segs; y= yBase*(1-isTip) + 1*isTip
    const yBase = div(rowF, float(segs));
    const yNorm = add(mul(yBase, sub(float(1), isTip)), isTip);

    // sideSign = -1 for left(0), +1 for right(1)
    const sideSign = sub(mul(sideF, float(2)), float(1));

    // taper: half width = 0.5*(1 - y)
    const halfW = mul(float(0.5), sub(float(1), yNorm));

    // x; at tip halfW=0 → x=0 (no branch)
    const xNorm = mul(sideSign, halfW);

    // local blade position at origin (grow up the +Y axis)
    const localPos = vec3(mul(xNorm, bW), mul(yNorm, bH), float(0));

    return localPos;
  });

  private create() {
    // color
    this.colorNode = this.computeDiffuse();

    // assign to node pipeline
    const localPos = this.computeBaseVertexPosition();
    this.positionNode = localPos;
  }

  private update(state: State) {
    const { clock } = state;
    this._uniforms.uTime.value = clock.getElapsedTime();
  }
}
