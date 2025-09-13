import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LOD,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Sphere,
  Vector3,
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
  instancedArray,
  instanceIndex,
  hash,
  texture,
  vec2,
  positionWorld,
  rotate,
  time,
  deltaTime,
  exp,
  mix,
  smoothstep,
} from "three/tsl";
import { State } from "../../../Game";
import { eventsManager } from "../../../systems/EventsManager";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { TextGeometry } from "three/examples/jsm/Addons.js";
import { assetManager } from "../../../systems/AssetManager";
import { tslUtils } from "../../../utils/TSLUtils";
import { rendererManager } from "../../../systems/RendererManager";
import { debugManager } from "../../../systems/DebugManager";

const getConfig = () => {
  const BLADE_WIDTH = 0.075;
  const BLADE_HEIGHT = 1.45;
  const TILE_SIZE = 40;
  const BLADES_PER_SIDE = 100;
  const SEGMENTS = 7; // must be odd

  const boundingSphereCenter = new Vector3(TILE_SIZE / 2, 0, TILE_SIZE / 2);
  const boundingSphereRadius = TILE_SIZE * 1.5;
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
    BOUNDING_SPHERE: new Sphere(boundingSphereCenter, boundingSphereRadius),
  };
};
const config = getConfig();

export default class NewGrass {
  private group = new Group();
  private nGrid = 5;
  private debug = {
    enableLodColors: false,
  };

  constructor() {
    const material = new GrassMaterial();
    const geometries = [
      this.createGeometry(5),
      this.createGeometry(3),
      this.createGeometry(1),
    ];
    this.group = this.createGrid(material, geometries);
    sceneManager.scene.add(this.group);
    eventsManager.on("update-throttle-16x", ({ player }) => {
      const dx = player.position.x - this.group.position.x;
      const dz = player.position.z - this.group.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < config.TILE_SIZE * config.TILE_SIZE) return; // don't move if within 1 tile
      this.group.position.x =
        Math.round(player.position.x / config.TILE_SIZE) * config.TILE_SIZE;
      this.group.position.z =
        Math.round(player.position.z / config.TILE_SIZE) * config.TILE_SIZE;

      this.wrapTiles(dx, dz);
    });
  }

  private createGrid(material: GrassMaterial, geometries: BufferGeometry[]) {
    const group = new Group();
    let idx = 0;
    for (let i = 0; i < this.nGrid; i++) {
      for (let j = 0; j < this.nGrid; j++) {
        idx++;
        const x = (i - Math.floor(this.nGrid / 2)) * config.TILE_SIZE;
        const z = (j - Math.floor(this.nGrid / 2)) * config.TILE_SIZE;
        const tile = this.createTile(material, geometries);
        tile.position.set(x, 0, z);

        // // add text geometry label to tile with the incremental index
        // const textGeom = new TextGeometry(`${idx}`, {
        //   font: assetManager.font,
        //   size: 5,
        //   depth: 0.2,
        //   curveSegments: 12,
        //   bevelEnabled: false,
        // });
        // textGeom.center();
        // textGeom.rotateX(-Math.PI / 2);
        // textGeom.translate(0, 0.2, 0);
        // const textMaterial = new MeshBasicMaterial({ color: "white" });
        // const textMesh = new Mesh(textGeom, textMaterial);
        // tile.add(textMesh);

        group.add(tile);
      }
    }
    return group;
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

    const geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(indices, 1));
    return geometry;
  }

  private createTile(material: GrassMaterial, geometries: BufferGeometry[]) {
    const lod = new LOD();
    const meshHigh = new InstancedMesh(geometries[0], material, config.COUNT);
    meshHigh.boundingSphere = config.BOUNDING_SPHERE;
    // meshHigh.onBeforeRender = (_, __, ___, ____, material: GrassMaterial) => {
    //   material.colorNode = color("darkgreen");
    // };
    lod.addLevel(meshHigh, 0);
    const meshMid = new InstancedMesh(geometries[1], material, config.COUNT);
    meshMid.boundingSphere = config.BOUNDING_SPHERE;
    // meshMid.onBeforeRender = (_, __, ___, ____, material: GrassMaterial) => {
    //   material.colorNode = color("orange");
    // };
    lod.addLevel(meshMid, 50);
    const meshLow = new InstancedMesh(geometries[2], material, config.COUNT);
    meshLow.boundingSphere = config.BOUNDING_SPHERE;
    // meshLow.onBeforeRender = (_, __, ___, ____, material: GrassMaterial) => {
    //   material.colorNode = color("red");
    // };
    lod.addLevel(meshLow, 100);
    return lod;
  }
}

const createUniforms = () => ({
  uSegments: uniform(3),
  uBladeWidth: uniform(config.BLADE_WIDTH),
  uBladeHeight: uniform(config.BLADE_HEIGHT),
  uWindStrength: uniform(0.6),
});

const uniforms = createUniforms();

class GrassMaterial extends MeshBasicNodeMaterial {
  private buffer: ReturnType<typeof instancedArray>;

  constructor() {
    super();
    const { ssbo, update } = createSsbo();
    this.buffer = ssbo;
    eventsManager.on("update", () => {
      rendererManager.renderer.computeAsync(update);
    });

    // eventsManager.on("update-throttle-4x", () => {
    //   rendererManager.renderer.computeAsync(update);
    // });

    this.create();
  }

  private computeDiffuse = Fn(() => {
    return color("darkgreen");
  });

  private computeBaseVertexPosition = Fn(() => {
    // aliases
    const segs = uniforms.uSegments;
    const bW = uniforms.uBladeWidth;
    const bH = uniforms.uBladeHeight;

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

  private computeAO = Fn(([localPos = vec3(0, 0, 0)]) => {
    const uvX = localPos.x.add(0.5);
    const uvY = localPos.y;

    const instanceBias = hash(instanceIndex).mul(0.5).sub(0.05);
    const sideFactor = smoothstep(0, 1.2, abs(uvX.add(instanceBias)));

    const baseFactor = smoothstep(0, 0.6, uvY.negate());

    const midFactor = smoothstep(0.3, 0.6, uvY).mul(0.1);

    const combined = baseFactor.add(sideFactor).add(midFactor).mul(0.75);

    const ao = float(1.0).sub(combined);

    return ao.mul(1.2);
  });

  private create() {
    this.precision = "lowp";
    this.side = DoubleSide;
    const data = this.buffer.element(instanceIndex);

    // color
    this.colorNode = this.computeDiffuse();

    // position + rotation
    const offsetX = tslUtils.unpackUnits(
      data.x,
      0,
      12,
      -config.TILE_HALF_SIZE,
      config.TILE_HALF_SIZE,
    );
    const offsetZ = tslUtils.unpackUnits(
      data.x,
      12,
      12,
      -config.TILE_HALF_SIZE,
      config.TILE_HALF_SIZE,
    );
    const localPos = this.computeBaseVertexPosition();
    const yaw = tslUtils.unpackAngle(data.y, 0, 8);

    const windUV = positionWorld.xz.add(time.mul(0.25)).mul(0.5).fract();

    const windStrength = texture(assetManager.noiseTexture, windUV, 2).r;

    const lean = windStrength.mul(uniforms.uWindStrength).mul(localPos.y);

    const rotatedPos = rotate(localPos, vec3(lean, yaw, 0));
    const offsetPos = rotatedPos.add(vec3(offsetX, 0, offsetZ));
    this.positionNode = offsetPos;

    // alpha
    const alphaUv = tslUtils.computeMapUvByPosition(positionWorld.xz);
    const alpha = texture(assetManager.terrainTypeMap, alphaUv).g;
    const threshold = step(0.25, alpha);
    this.alphaTest = 0.5;
    this.opacityNode = alpha.mul(threshold);

    this.aoNode = this.computeAO(localPos);
  }
}

const createSsbo = () => {
  const ssbo = instancedArray(config.COUNT, "vec4");
  ssbo.setPBO(true);

  const init = Fn(() => {
    const data = ssbo.element(instanceIndex);

    // grid constants
    const N = float(config.BLADES_PER_SIDE); // blades per side
    const size = float(config.TILE_SIZE); // tile size
    const cell = size.div(N); // cell size (spacing)

    // instance -> row/col
    const row = floor(float(instanceIndex).div(N)); // 0..N-1
    const col = mod(float(instanceIndex), N); // 0..N-1

    const j = 0.75; // fraction of half-cell
    const jx = hash(instanceIndex.mul(73))
      .mul(2)
      .sub(1)
      .mul(cell.mul(0.5).mul(j));
    const jz = hash(instanceIndex.mul(137))
      .mul(2)
      .sub(1)
      .mul(cell.mul(0.5).mul(j));
    const x = col.add(0.5).mul(cell).sub(config.TILE_HALF_SIZE).add(jx);
    const z = row.add(0.5).mul(cell).sub(config.TILE_HALF_SIZE).add(jz);

    data.x = tslUtils.packUnits(
      data.x,
      0,
      12,
      x,
      -config.TILE_HALF_SIZE,
      config.TILE_HALF_SIZE,
    );
    data.x = tslUtils.packUnits(
      data.x,
      12,
      12,
      z,
      -config.TILE_HALF_SIZE,
      config.TILE_HALF_SIZE,
    );

    const _uv = vec3(x, 0, z)
      .xz.add(config.TILE_HALF_SIZE)
      .div(config.TILE_SIZE)
      .abs();

    const noise = texture(assetManager.noiseTexture, _uv);

    const yaw = noise.b.mul(float(Math.PI * 2));
    data.y = tslUtils.packAngle(data.y, 0, 8, yaw);

    data.z = float(0);
    data.w = float(0);
  })().compute(config.COUNT);

  const update = Fn(() => {
    const data = ssbo.element(instanceIndex);
    const x = tslUtils.unpackUnits(
      data.x,
      0,
      12,
      -config.TILE_HALF_SIZE,
      config.TILE_HALF_SIZE,
    );
    const z = tslUtils.unpackUnits(
      data.x,
      12,
      12,
      -config.TILE_HALF_SIZE,
      config.TILE_HALF_SIZE,
    );

    const tau = float(0.35); // smoothing time constant (seconds)
    const alpha = sub(float(1.0), exp(time.negate().div(tau))); // alpha = 1 - e^(-dt/τ)

    const windUV = vec2(x, z).add(time.mul(0.25)).mul(0.5).fract();
    const strength = texture(assetManager.noiseTexture, windUV, 2).r;
    const prev = tslUtils.unpackAngle(data.y, 8, 8);
    const target = strength.mul(uniforms.uWindStrength);
    const lean = mix(prev, target, alpha);
    data.y = tslUtils.packAngle(data.y, 8, 8, lean);
  })().compute(config.COUNT);

  update.onInit(({ renderer }) => {
    renderer.computeAsync(init);
  });

  return { ssbo, update };
};
