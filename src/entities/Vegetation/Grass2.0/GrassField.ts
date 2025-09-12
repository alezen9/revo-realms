import { BufferAttribute, BufferGeometry, Group, InstancedMesh } from "three";
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

const getConfig = () => {
  const BLADE_WIDTH = 0.075;
  const BLADE_HEIGHT = 1.45;
  const TILE_SIZE = 25;
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
  constructor() {
    const tile = this.createTile(this.material);
    this.group.add(tile);
    sceneManager.scene.add(this.group);
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
  private baseUniforms = {
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
    return color(0x2e8b57); // seagreen-ish
  });

  private computeBaseVertexPosition = Fn(() => {
    // aliases
    const segs = this.baseUniforms.uSegments;
    const bW = this.baseUniforms.uBladeWidth;
    const bH = this.baseUniforms.uBladeHeight;

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
    this.baseUniforms.uTime.value = clock.getElapsedTime();
  }
}
