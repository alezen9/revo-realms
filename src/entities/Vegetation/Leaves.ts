import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  StaticDrawUsage,
  Vector2,
  Vector3,
} from "three/webgpu";
import { sceneManager } from "../../systems/SceneManager";
import {
  Fn,
  hash,
  instancedArray,
  instanceIndex,
  mod,
  positionLocal,
  uniform,
  vec2,
  vec4,
  texture,
  fract,
  sin,
  cos,
  time,
  float,
  normalize,
  rotate,
  vec3,
  PI2,
  uv,
  mix,
  color,
  deltaTime,
} from "three/tsl";
import { eventsManager } from "../../systems/EventsManager";
import { rendererManager } from "../../systems/RendererManager";
import { assetManager } from "../../systems/AssetManager";
import { tslUtils } from "../../utils/TSLUtils";
import { debugManager } from "../../systems/DebugManager";

const getConfig = () => {
  const COUNT = 128;
  const TILE_SIZE = 75;
  const TILE_HEIGHT = 10;
  const LEAF_SIZE = 0.75;
  const LEAF_BEND = 0.15;
  return {
    HALF_LEAF_SIZE: LEAF_SIZE / 2,
    HALF_LEAF_BEND: LEAF_BEND / 2,
    COUNT,
    TILE_SIZE,
    HALF_TILE_SIZE: TILE_SIZE / 2,
    TILE_HEIGHT,
    HALF_TILE_HEIGHT: TILE_HEIGHT / 2,
    WORKGROUP_SIZE: 128,
  };
};

const config = getConfig();

const uniforms = {
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uCameraMatrix: uniform(new Matrix4()),
  uDelta: uniform(new Vector2(0, 0)),
  uSpeed: uniform(0.075),
};

class LeavesSsbo {
  // x -> offsetX (0 unused)
  // y -> offsetY (0 unused)
  // z -> offsetZ (0 unused)
  // w -> rotation (0 unused)
  private buffer: ReturnType<typeof instancedArray>;

  constructor() {
    this.buffer = instancedArray(config.COUNT, "vec4");
    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
  }

  get computeBuffer() {
    return this.buffer;
  }

  getRotation = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackAngle(data.w, 0, 12);
  });

  setRotation = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = tslUtils.packAngle(data.w, 0, 12, value);
    return data;
  });

  private computeInit = Fn(() => {
    const data = this.buffer.element(instanceIndex);

    const rx = hash(instanceIndex.add(1.0)).sub(0.5).mul(config.TILE_SIZE);
    const ry = hash(instanceIndex.add(2.0))
      .sub(0.5)
      .mul(config.HALF_TILE_HEIGHT);
    const rz = hash(instanceIndex.add(3.0)).sub(0.5).mul(config.TILE_SIZE);

    // write xyz = random pos in cube, w = 0 (reserved for packed rotation)
    data.assign(vec4(rx, ry, rz, 0.0));
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  /** simple modulation/wrapping */
  //   computeUpdate = Fn(() => {
  //     const data = this.buffer.element(instanceIndex);

  //     // shift offsets by inverse delta (since you moved the mesh to the player)
  //     const sx = data.x.sub(uniforms.uDelta.x);
  //     const sz = data.z.sub(uniforms.uDelta.y);

  //     // v' = mod(v + half, size) - half   (works for negative v too)
  //     const wx = mod(sx.add(config.HALF_TILE_SIZE), config.TILE_SIZE).sub(
  //       config.HALF_TILE_SIZE,
  //     );
  //     const wz = mod(sz.add(config.HALF_TILE_SIZE), config.TILE_SIZE).sub(
  //       config.HALF_TILE_SIZE,
  //     );

  //     // write back, preserve w for your packed rotations
  //     data.assign(vec4(wx, data.y, wz, data.w));
  //   })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  /** moving super nicely */
  computeUpdate = Fn(() => {
    const data = this.buffer.element(instanceIndex);

    // --- read current local offsets
    const ox = data.x;
    const oy = data.y; // keep as-is
    const oz = data.z;

    // --- shift by inverse player delta (mesh follows player)
    const shiftedX = ox.sub(uniforms.uDelta.x);
    const shiftedZ = oz.sub(uniforms.uDelta.y);

    // --- world XZ centered on player (used for flow + noise UV)
    const worldXZ = vec2(
      uniforms.uPlayerPosition.x,
      uniforms.uPlayerPosition.z,
    ).add(vec2(shiftedX, shiftedZ));

    // =========================
    // Analytic divergence-free flow (curl of a stream function)
    // =========================
    // stream function ψ(x,z,t) = sum of a few sines at different scales
    // flowDir = ( dψ/dz, -dψ/dx )

    // per-instance seeds (stable)
    const seedA = hash(instanceIndex.add(11.0));
    const seedB = hash(instanceIndex.add(23.0));
    const seedC = hash(instanceIndex.add(37.0));

    // amplitudes (meters per step) – small to keep movement gentle
    const amp1 = float(0.035);
    const amp2 = float(0.03);
    const amp3 = float(0.02);

    // spatial frequencies (1/m), tied to tile size so features are readable
    const k1 = float(2.0 / (config.TILE_SIZE * 0.9));
    const k2 = float(2.0 / (config.TILE_SIZE * 1.3));
    const k3 = float(2.0 / (config.TILE_SIZE * 0.7));

    // temporal frequencies (rad/s), slightly decorrelated per instance
    const w1 = float(0.2).add(seedA.mul(0.1));
    const w2 = float(0.13).add(seedB.mul(0.1));
    const w3 = float(0.09).add(seedC.mul(0.08));

    // phases per instance
    const phase1 = seedA.mul(PI2);
    const phase2 = seedB.mul(PI2);
    const phase3 = seedC.mul(PI2);

    // compute partials analytically
    const x1 = worldXZ.x.mul(PI2).mul(k1);
    const z2 = worldXZ.y.mul(PI2).mul(k2);
    const xz3 = worldXZ.x.add(worldXZ.y).mul(PI2).mul(k3);

    const dpsi_dx = amp1
      .mul(PI2)
      .mul(k1)
      .mul(cos(x1.add(time.mul(w1)).add(phase1)))
      .add(
        amp3
          .mul(PI2)
          .mul(k3)
          .mul(cos(xz3.add(time.mul(w3)).add(phase3))),
      );

    const dpsi_dz = amp2
      .mul(PI2)
      .mul(k2)
      .mul(cos(z2.add(time.mul(w2)).add(phase2)))
      .add(
        amp3
          .mul(PI2)
          .mul(k3)
          .mul(cos(xz3.add(time.mul(w3)).add(phase3))),
      );

    const flowDir = normalize(vec2(dpsi_dz, dpsi_dx.negate()));

    // =========================
    // Single noise lookup to modulate speed + rotation
    // =========================
    const noiseScale = float(1.0 / 80.0);
    const scroll = float(0.02);
    const noiseUV = fract(worldXZ.mul(noiseScale).add(vec2(time.mul(scroll))));
    const noiseSample = texture(assetManager.noiseTexture, noiseUV).rgb; // r=perlin, g=voronoi, b=random

    // gentle breathing and per-leaf variation from noise (no sharp changes)
    const breathing = float(0.85).add(
      sin(time.mul(0.25).add(phase1)).mul(0.15),
    );
    const speed = uniforms.uSpeed
      .mul(breathing)
      .mul(float(0.8).add(noiseSample.r.mul(0.6))); // 0.8..1.4x

    // integrate one small step along the curl field
    const movedX = shiftedX.add(flowDir.x.mul(speed));
    const movedZ = shiftedZ.add(flowDir.y.mul(speed));

    // wrap back to centered cube
    const half = float(config.HALF_TILE_SIZE);
    const size = float(config.TILE_SIZE);
    const wrappedX = mod(movedX.add(half), size).sub(half);
    const wrappedZ = mod(movedZ.add(half), size).sub(half);

    // ---- vertical: small bob *velocity* + steady fall, then wrap in band
    // const yHalf = float(config.HALF_TILE_HEIGHT);
    // const ySpan = float(config.TILE_HEIGHT);

    // per-leaf seeds
    // const seedY = hash(instanceIndex.add(97.0));
    // const phaseY = seedY.mul(PI2);

    // tiny bob velocity (no big sine arcs)
    // const bobVel = sin(time.mul(0.6).add(phaseY)).mul(0.01); // ~1 cm/step

    // steady downward drift with mild per-leaf variation
    // const fallVel = float(0.015).add(seedY.mul(0.008)); // ~1.5–2.3 cm/step

    // integrate and wrap into [-yHalf, +yHalf]
    // const movedY = oy.add(bobVel).sub(fallVel);
    // const wrappedY = mod(movedY.add(yHalf), ySpan).sub(yHalf);

    // accumulate rotation angle in w (use noise to vary omega)
    const omega = float(0.8).add(noiseSample.g.mul(1.2)); // rad/s ≈ 0.8..2.0
    const dTheta = omega.mul(deltaTime);
    const oRotation = this.getRotation(data);
    const nextRotation = mod(oRotation.add(dTheta), PI2);

    // write back
    const newData = this.setRotation(
      vec4(wrappedX, oy, wrappedZ, data.w),
      nextRotation,
    );
    data.assign(newData);
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);
}

export default class Leaves {
  constructor() {
    const ssbo = new LeavesSsbo();
    const geometry = this.createGeometry();
    const material = new LeafMaterial(ssbo);
    const leaves = new InstancedMesh(geometry, material, config.COUNT);
    leaves.frustumCulled = false;
    leaves.position.set(0, 2, 0);
    sceneManager.scene.add(leaves);

    this.debugLeaves();

    eventsManager.on("update", ({ player }) => {
      const dx = player.position.x - leaves.position.x;
      const dz = player.position.z - leaves.position.z;
      uniforms.uDelta.value.set(dx, dz);
      uniforms.uPlayerPosition.value.copy(player.position);
      uniforms.uCameraMatrix.value
        .copy(sceneManager.playerCamera.projectionMatrix)
        .multiply(sceneManager.playerCamera.matrixWorldInverse);

      leaves.position.copy(player.position).setY(config.HALF_TILE_HEIGHT);

      rendererManager.renderer.computeAsync(ssbo.computeUpdate);
    });
  }

  private debugLeaves() {
    const folder = debugManager.panel.addFolder({
      title: "🍁 Leaves",
      expanded: false,
    });
    folder.addBinding(uniforms.uSpeed, "value", {
      label: "Speed",
      step: 0.01,
      min: 0,
      max: 1,
    });
  }

  private createGeometry() {
    const hw = config.HALF_LEAF_SIZE;
    const hh = config.HALF_LEAF_SIZE;

    const up = config.HALF_LEAF_BEND;
    const dn = -config.HALF_LEAF_BEND;

    const positions = new Float32Array([
      -hw,
      +hh,
      up,
      +hw,
      +hh,
      dn,
      +hw,
      -hh,
      up,
      -hw,
      -hh,
      dn,
    ]);

    const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);

    const indices = new Uint8Array([0, 1, 2, 0, 2, 3]);

    const geom = new BufferGeometry();

    const posAttribute = new BufferAttribute(positions, 3);
    posAttribute.setUsage(StaticDrawUsage);
    geom.setAttribute("position", posAttribute);

    const uvAttribute = new BufferAttribute(uvs, 2);
    uvAttribute.setUsage(StaticDrawUsage);
    geom.setAttribute("uv", uvAttribute);

    const indexAttribute = new BufferAttribute(indices, 1);
    indexAttribute.setUsage(StaticDrawUsage);
    geom.setIndex(indexAttribute);

    const normals = new Float32Array(indices.length * 3);
    const normalAttribute = new BufferAttribute(normals, 3);
    normalAttribute.setUsage(StaticDrawUsage);
    geom.setAttribute("normal", normalAttribute);

    return geom;
  }
}

class LeafMaterial extends MeshBasicNodeMaterial {
  private ssbo: LeavesSsbo;

  constructor(ssbo: LeavesSsbo) {
    super();
    this.ssbo = ssbo;
    this.createMaterial();
  }

  private createMaterial() {
    this.side = DoubleSide;

    const diffuse = texture(assetManager.leafDiffuse, uv());
    this.colorNode = mix(diffuse.rgb, color("darkgreen"), 0.6);
    this.opacityNode = diffuse.a;
    this.alphaTest = 0.1;

    const data = this.ssbo.computeBuffer.element(instanceIndex);
    const rotation = this.ssbo.getRotation(data);
    const rotatedPosition = rotate(positionLocal, vec3(rotation, rotation, 0));
    this.positionNode = rotatedPosition.add(data.xyz);
  }
}
