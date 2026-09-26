import {
  BoxGeometry,
  Color,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import {
  BatchedMesh,
  StorageBufferAttribute,
  type Node,
  type StorageBufferNode,
} from "three/webgpu";
import {
  bool,
  cos,
  float,
  Fn,
  hash,
  instanceIndex,
  positionLocal,
  sin,
  storage,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  assetManager,
  debugManager,
  eventsManager,
  rendererManager,
  sceneManager,
  shadowCasterRegistry,
} from "../systems";
import { DirectSunLambertNodeMaterial } from "../systems/ShadowManager/DirectSunMaterials";
import type { ShadowGpuInstances } from "../systems/ShadowManager/ShadowCasterRegistry";
import type { ComputeTask } from "../systems/RendererManager/ComputeTask";
import { realmConfig } from "../realm/config";
import { gameTime } from "../utils/GameTime";
import { TSLUtils } from "../utils/TSLUtils";

const config = {
  STATIC_COUNT: 2000,
  MOVING_COUNT: 300,
  DEFORMING_COUNT: 300,
  GPU_COUNT: 5000,
  MOVING_ORBIT_RADIUS: 3,
  MOVING_ORBIT_SPEED: 0.6,
  DEFORMING_EXTENT: 0.9,
  GPU_HOVER: 1.5,
};

const uniforms = {
  uSpread: uniform(realmConfig.HALF_MAP_SIZE),
  uGpuHover: uniform(config.GPU_HOVER),
};

const getTerrainHeightNode = (position: Node<"vec2">) => {
  const mapUv = TSLUtils.computeMapUvByPosition(position);
  return texture(
    assetManager.resources.heightmap,
    vec2(mapUv.x, float(1).sub(mapUv.y)),
  ).r;
};

const sampleTerrainHeight = (x: number, z: number) => {
  const { data, width, height } = assetManager.resources.heightmap.image;
  if (!data) throw new Error("Stress test needs terrain heights");
  const u = (x + realmConfig.HALF_MAP_SIZE) / realmConfig.MAP_SIZE;
  const v = (z + realmConfig.HALF_MAP_SIZE) / realmConfig.MAP_SIZE;
  const column = Math.round(Math.min(Math.max(u, 0), 1) * (width - 1));
  const row = Math.round(Math.min(Math.max(1 - v, 0), 1) * (height - 1));
  return data[row * width + column];
};

const getDeformedPosition = (
  instance: Node<"vec4">,
  index: Node<"uint">,
  localPosition: Node<"vec3">,
) => {
  const phase = hash(index).mul(Math.PI * 2);
  const wobble = sin(gameTime.mul(3).add(localPosition.y.mul(4)).add(phase))
    .mul(0.25)
    .add(1);
  return instance.xyz.add(localPosition.mul(wobble).mul(instance.w));
};

const createGpuPositionsNode = (positions: StorageBufferNode<"vec4">) =>
  Fn(() => {
    const seed = float(instanceIndex);
    const anchor = vec2(hash(seed.add(1)), hash(seed.add(2)))
      .mul(2)
      .sub(1)
      .mul(uniforms.uSpread);
    const orbitRadius = hash(seed.add(3)).mul(4).add(2);
    const angle = gameTime
      .mul(hash(seed.add(4)).mul(0.8).add(0.2))
      .add(hash(seed.add(5)).mul(Math.PI * 2));
    const position = anchor.add(vec2(cos(angle), sin(angle)).mul(orbitRadius));
    const scale = hash(seed.add(6)).mul(0.6).add(0.4);
    positions
      .element(instanceIndex)
      .assign(
        vec4(
          position.x,
          getTerrainHeightNode(position).add(uniforms.uGpuHover),
          position.y,
          scale,
        ),
      );
  })().compute(config.GPU_COUNT, [64]);

const randomSpread = () => (Math.random() * 2 - 1) * realmConfig.HALF_MAP_SIZE;

class StressMaterial extends DirectSunLambertNodeMaterial {
  constructor(color: Color, positionNode?: Node<"vec3">) {
    super();
    this.colorNode = vec3(color.r, color.g, color.b);
    if (positionNode) this.positionNode = positionNode;
  }
}

export default class ShadowStressTest {
  private settings = {
    isEnabled: false,
    hasStatic: true,
    hasMoving: true,
    hasDeforming: true,
    hasGpu: true,
  };
  private geometries: BufferGeometry[] = [];
  private shadowGeometries: BufferGeometry[] = [];
  private materials: StressMaterial[] = [];
  private staticBatch?: BatchedMesh;
  private movingMeshes: Mesh[] = [];
  private movingAnchors: Vector3[] = [];
  private movingPhases: number[] = [];
  private deformingMesh?: InstancedMesh;
  private gpuMesh?: InstancedMesh;
  private deformingValues = new Float32Array(config.DEFORMING_COUNT * 4);
  private deformingInstances = storage(
    new StorageBufferAttribute(this.deformingValues, 4),
    "vec4",
    config.DEFORMING_COUNT,
  );
  private gpuPositions = storage(
    new StorageBufferAttribute(new Float32Array(config.GPU_COUNT * 4), 4),
    "vec4",
    config.GPU_COUNT,
  );
  private gpuComputeTask: ComputeTask;
  private elapsed = 0;

  constructor() {
    this.gpuComputeTask = rendererManager.createComputeTask({
      label: "Shadow stress gpu instances",
      update: createGpuPositionsNode(this.gpuPositions),
    });
    eventsManager.on("engine-render-update", this.onEngineUpdate);
    this.debug();
  }

  private createStatic(geometries: BufferGeometry[]) {
    const material = new StressMaterial(new Color(0.75, 0.7, 0.62));
    let vertexCount = 0;
    let indexCount = 0;
    for (const geometry of geometries) {
      vertexCount += geometry.getAttribute("position").count;
      indexCount += geometry.index?.count ?? 0;
    }
    const batch = new BatchedMesh(
      config.STATIC_COUNT,
      vertexCount,
      indexCount,
      material,
    );
    const geometryIds = geometries.map((geometry) =>
      batch.addGeometry(geometry),
    );
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const position = new Vector3();
    for (let index = 0; index < config.STATIC_COUNT; index++) {
      const instanceId = batch.addInstance(
        geometryIds[index % geometryIds.length],
      );
      const size = 0.5 + Math.random() * 1.5;
      position.set(randomSpread(), 0, randomSpread());
      position.y = sampleTerrainHeight(position.x, position.z) + size * 0.4;
      rotation.setFromEuler(
        new Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0),
      );
      scale.setScalar(size);
      batch.setMatrixAt(instanceId, matrix.compose(position, rotation, scale));
    }
    sceneManager.mainScene.add(batch);
    shadowCasterRegistry.register(batch);
    this.staticBatch = batch;
    this.materials.push(material);
  }

  private createMoving(geometries: BufferGeometry[]) {
    const material = new StressMaterial(new Color(0.85, 0.35, 0.25));
    for (let index = 0; index < config.MOVING_COUNT; index++) {
      const mesh = new Mesh(geometries[index % geometries.length], material);
      mesh.scale.setScalar(0.6 + Math.random() * 0.8);
      const anchor = new Vector3(randomSpread(), 0, randomSpread());
      this.movingAnchors.push(anchor);
      this.movingPhases.push(Math.random() * Math.PI * 2);
      this.movingMeshes.push(mesh);
      sceneManager.mainScene.add(mesh);
      shadowCasterRegistry.register(mesh, { motion: "moving" });
    }
    this.materials.push(material);
  }

  private createDeforming(geometry: BufferGeometry) {
    for (let index = 0; index < config.DEFORMING_COUNT; index++) {
      const x = randomSpread();
      const z = randomSpread();
      const scale = 0.6 + Math.random() * 1.2;
      this.deformingValues.set(
        [
          x,
          sampleTerrainHeight(x, z) + scale * config.DEFORMING_EXTENT,
          z,
          scale,
        ],
        index * 4,
      );
    }
    this.deformingInstances.value.needsUpdate = true;
    const instances = this.deformingInstances;
    const material = new StressMaterial(
      new Color(0.3, 0.55, 0.85),
      getDeformedPosition(
        instances.element(instanceIndex),
        instanceIndex,
        positionLocal,
      ),
    );
    const mesh = new InstancedMesh(geometry, material, config.DEFORMING_COUNT);
    mesh.frustumCulled = false;
    const shadowGeometry = geometry.toNonIndexed();
    const gpuInstances: ShadowGpuInstances = {
      count: config.DEFORMING_COUNT,
      radiusMeters: 2.4,
      geometry: shadowGeometry,
      isActive: () => bool(true),
      baseWorldPosition: (index) => {
        const instance = instances.element(index);
        return instance.xyz.sub(
          vec3(0, instance.w.mul(config.DEFORMING_EXTENT), 0),
        );
      },
      height: (index) =>
        instances.element(index).w.mul(config.DEFORMING_EXTENT * 2),
      worldPosition: (index, position) =>
        getDeformedPosition(instances.element(index), index, position),
    };
    sceneManager.mainScene.add(mesh);
    shadowCasterRegistry.register(mesh, { gpuInstances });
    this.deformingMesh = mesh;
    this.shadowGeometries.push(shadowGeometry);
    this.materials.push(material);
  }

  private createGpu(geometry: BufferGeometry) {
    const positions = this.gpuPositions;
    const material = new StressMaterial(
      new Color(0.4, 0.8, 0.45),
      positions
        .element(instanceIndex)
        .xyz.add(positionLocal.mul(positions.element(instanceIndex).w)),
    );
    const mesh = new InstancedMesh(geometry, material, config.GPU_COUNT);
    mesh.frustumCulled = false;
    const shadowGeometry = geometry.toNonIndexed();
    const gpuInstances: ShadowGpuInstances = {
      count: config.GPU_COUNT,
      radiusMeters: 0.6,
      geometry: shadowGeometry,
      isActive: () => bool(true),
      baseWorldPosition: (index) => {
        const position = positions.element(index);
        return position.xyz.sub(vec3(0, position.w.mul(0.5), 0));
      },
      height: (index) => positions.element(index).w,
      worldPosition: (index, sourcePosition) =>
        positions
          .element(index)
          .xyz.add(sourcePosition.mul(positions.element(index).w)),
    };
    sceneManager.mainScene.add(mesh);
    shadowCasterRegistry.register(mesh, { gpuInstances });
    this.gpuMesh = mesh;
    this.shadowGeometries.push(shadowGeometry);
    this.materials.push(material);
  }

  private enable() {
    const box = new BoxGeometry(1, 1, 1);
    const sphere = new SphereGeometry(0.6, 16, 12);
    const torus = new TorusGeometry(0.5, 0.2, 10, 24);
    const deformingTorus = torus.clone();
    const gpuBox = box.clone();
    this.geometries = [box, sphere, torus, deformingTorus, gpuBox];
    if (this.settings.hasStatic) this.createStatic([box, sphere, torus]);
    if (this.settings.hasMoving) this.createMoving([box, sphere, torus]);
    if (this.settings.hasDeforming) this.createDeforming(deformingTorus);
    if (this.settings.hasGpu) this.createGpu(gpuBox);
  }

  private disable() {
    const meshes = [
      this.staticBatch,
      this.deformingMesh,
      this.gpuMesh,
      ...this.movingMeshes,
    ];
    for (const mesh of meshes) {
      if (!mesh) continue;
      sceneManager.mainScene.remove(mesh);
      shadowCasterRegistry.unregister(mesh);
    }
    this.staticBatch?.dispose();
    this.deformingMesh?.dispose();
    this.gpuMesh?.dispose();
    for (const geometry of [...this.geometries, ...this.shadowGeometries])
      geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.staticBatch = undefined;
    this.deformingMesh = undefined;
    this.gpuMesh = undefined;
    this.movingMeshes = [];
    this.movingAnchors = [];
    this.movingPhases = [];
    this.geometries = [];
    this.shadowGeometries = [];
    this.materials = [];
  }

  private onEngineUpdate = ({ delta }: { delta: number }) => {
    if (!this.settings.isEnabled) return;
    this.elapsed += delta;
    if (this.gpuMesh) this.gpuComputeTask.update();
    for (let index = 0; index < this.movingMeshes.length; index++) {
      const mesh = this.movingMeshes[index];
      const anchor = this.movingAnchors[index];
      const angle =
        this.elapsed * config.MOVING_ORBIT_SPEED + this.movingPhases[index];
      const x = anchor.x + Math.cos(angle) * config.MOVING_ORBIT_RADIUS;
      const z = anchor.z + Math.sin(angle) * config.MOVING_ORBIT_RADIUS;
      mesh.position.set(x, sampleTerrainHeight(x, z) + mesh.scale.x, z);
      mesh.rotation.set(angle, angle * 0.5, 0);
      shadowCasterRegistry.markMoved(mesh);
    }
  };

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🧪 Shadow stress test",
      expanded: false,
    });
    folder.addBinding(this.settings, "hasStatic", { label: "Static" });
    folder.addBinding(this.settings, "hasMoving", { label: "CPU moving" });
    folder.addBinding(this.settings, "hasDeforming", {
      label: "GPU deforming",
    });
    folder.addBinding(this.settings, "hasGpu", { label: "GPU positioned" });
    folder
      .addBinding(this.settings, "isEnabled", { label: "Enabled" })
      .on("change", ({ value }) => {
        if (value) this.enable();
        else this.disable();
      });
  }
}
