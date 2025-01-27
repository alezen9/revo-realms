import {
  Vector3,
  Mesh,
  MeshBasicMaterial,
  Vector2,
  PlaneGeometry,
} from "three";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d-compat";
import { State } from "../Game";
import {
  MeshBasicNodeMaterial,
  MeshPhongNodeMaterial,
  MeshStandardMaterial,
  Texture,
} from "three/webgpu";
import worldModelUrl from "/environment/world.glb?url";
import floorTextureUrl from "/environment/floor.webp?url";
import { GLTF, VertexNormalsHelper } from "three/examples/jsm/Addons.js";
import { debugManager } from "../systems/DebugManager";
import WaterMaterial from "../other/WaterMaterial";
import {
  add,
  color,
  cos,
  cross,
  float,
  Fn,
  fract,
  length,
  linearDepth,
  mix,
  modelWorldMatrix,
  mul,
  mx_worley_noise_float,
  normalize,
  normalLocal,
  positionGeometry,
  positionLocal,
  positionWorld,
  screenUV,
  sin,
  smoothstep,
  sub,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  viewportDepthTexture,
  viewportLinearDepth,
  viewportSharedTexture,
} from "three/tsl";
import { assetManager } from "../systems/AssetManager";

export default class PortfolioRealm {
  private readonly HALF_FLOOR_THICKNESS = 0.3;
  private readonly MAP_SIZE = 256;
  private readonly HALF_MAP_SIZE = this.MAP_SIZE / 2;
  private readonly KINTOUN_ACTIVATION_THRESHOLD = 2;

  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball
  private kintounPosition = new Vector3();

  private uTime = uniform(0);
  private uWavesFrequency = uniform(new Vector2(4, 2));
  private uWavesSpeed = uniform(0.003);
  private uWavesElevation = uniform(0.3);
  private uNoiseMultiplier = uniform(-2);
  private uShift = uniform(0.1);
  private uDivisor = uniform(10);

  constructor(state: Pick<State, "assetManager" | "world" | "scene">) {
    const { assetManager, world, scene } = state;
    if (!world) throw new Error("world is undefined");

    const floorTexture = assetManager.textureLoader.load(floorTextureUrl);
    floorTexture.flipY = false;

    assetManager.gltfLoader.load(worldModelUrl, (worldModel) => {
      this.createPhysics(worldModel, world);
      this.createVisual(worldModel, floorTexture, scene);
    });

    this.kintounRigidBody = this.createKintounCollider(world);
  }

  private createVisual(
    worldModel: GLTF,
    floorTexture: Texture,
    scene: State["scene"],
  ) {
    const floor = worldModel.scene.getObjectByName("floor") as Mesh;
    floor.geometry.computeVertexNormals();
    floor.material = new MeshStandardMaterial({ map: floorTexture });
    floor.receiveShadow = true;
    scene.add(floor);

    const lake = worldModel.scene.getObjectByName("lake") as Mesh;
    // lake.geometry.computeVertexNormals();
    const waterMaterial = this.createWaterMaterial();
    lake.material = waterMaterial;
    scene.add(lake);

    debugManager.panel.addBinding(this.uWavesFrequency, "value", {
      label: "Frequency",
    });
    debugManager.panel.addBinding(this.uWavesSpeed, "value", {
      label: "Speed",
    });
    debugManager.panel.addBinding(this.uWavesElevation, "value", {
      label: "Elevation",
    });
    debugManager.panel.addBinding(this.uNoiseMultiplier, "value", {
      label: "Noise multiplier",
    });
    debugManager.panel.addBinding(waterMaterial, "wireframe", {
      label: "Wireframe",
    });
    debugManager.panel.addBinding(this.uShift, "value", {
      label: "Shift",
    });
    debugManager.panel.addBinding(this.uDivisor, "value", {
      label: "Divisor",
    });
  }

  // replicate https://github.com/mrdoob/three.js/blob/master/examples/webgpu_backdrop_water.html
  // demo https://threejs.org/examples/?q=water#webgpu_backdrop_water
  // too expensive!
  private createWaterMaterial() {
    const materialNode = new MeshBasicNodeMaterial();

    const timer = this.uTime;
    const floorUV = positionWorld.xzy;
    const waterLayer0 = mx_worley_noise_float(floorUV.mul(4).add(timer));
    const waterLayer1 = mx_worley_noise_float(floorUV.mul(2).add(timer));

    const waterIntensity = waterLayer0.mul(waterLayer1);
    const waterColor = waterIntensity
      .mul(1.4)
      .mix(color(0x0487e2), color(0x74ccf4));

    materialNode.colorNode = waterColor;

    const depth = linearDepth();
    const depthWater = viewportLinearDepth.sub(depth);
    const depthEffect = depthWater.remapClamp(-0.002, 0.04);

    const refractionUV = screenUV.add(vec2(0, waterIntensity.mul(0.1)));

    const depthTestForRefraction = linearDepth(
      viewportDepthTexture(refractionUV),
    ).sub(depth);

    const depthRefraction = depthTestForRefraction.remapClamp(0, 0.1);

    const finalUV = depthTestForRefraction
      .lessThan(0)
      .select(screenUV, refractionUV);

    const viewportTexture = viewportSharedTexture(finalUV);

    materialNode.backdropNode = depthEffect.mix(
      viewportSharedTexture(),
      viewportTexture.mul(depthRefraction.mix(1, waterColor)),
    );
    materialNode.backdropAlphaNode = depthRefraction.oneMinus();
    materialNode.transparent = true;
    return materialNode;
  }

  // private getElevation = Fn(([pos = vec3(0, 0, 0)]) => {
  //   const elevation = sin(
  //     pos.x.mul(this.uWavesFrequency.x).add(this.uTime.mul(this.uWavesSpeed)),
  //   )
  //     .mul(
  //       cos(
  //         pos.z
  //           .mul(this.uWavesFrequency.y)
  //           .add(this.uTime.mul(this.uWavesSpeed)),
  //       ),
  //     )
  //     .mul(this.uWavesElevation);
  //   return elevation;
  // });

  // private applyWaveToNormals = Fn(() => {
  //   const shift = 0.01;
  //   const positionA = positionLocal.add(vec3(shift, 0, 0)); // shift only on X axes
  //   const displacedPositionA = positionA.add(
  //     positionA.x,
  //     this.getElevation(positionA),
  //     positionA.z,
  //   );
  //   const positionB = positionLocal.add(vec3(0, 0, -shift)); // shift only on Z axes
  //   const displacedPositionB = positionB.add(
  //     positionB.x,
  //     this.getElevation(positionB),
  //     positionB.z,
  //   );

  //   const tangentA = normalize(displacedPositionA.sub(positionLocal));
  //   const tangentB = normalize(displacedPositionB.sub(positionLocal));
  //   const computedNormal = normalize(cross(tangentA, tangentB));

  //   return computedNormal;
  // });

  // private applyWaveToPosition = Fn(() => {
  //   const elevation = this.getElevation(positionLocal);
  //   const displacedPosition = positionLocal.add(0, elevation, 0);
  //   return displacedPosition;
  // });

  // private createWaterMaterial() {
  //   const materialNode = new MeshPhongNodeMaterial({
  //     transparent: true,
  //     color: "lightblue",
  //     specular: "white",
  //   });

  //   materialNode.positionNode = this.applyWaveToPosition();
  //   materialNode.normalNode = this.applyWaveToNormals();

  //   return materialNode;
  // }

  private getDisplacementData(worldModel: GLTF) {
    const mesh = worldModel.scene.getObjectByName("heightfield") as Mesh;
    const displacement = mesh.geometry.attributes._displacement.array[0]; // they are all the same
    const positionAttribute = mesh.geometry.attributes.position;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const boundingBoxAttribute = mesh.geometry.boundingBox!;
    const totalCount = positionAttribute.count;
    const rowsCount = Math.sqrt(totalCount);

    // half extent of the plane size, plane is a square centred at 0,0 in Blender <- IMPORTANT
    const halfExtent = boundingBoxAttribute.max.x;

    const heights = new Float32Array(totalCount);

    for (let i = 0; i < totalCount; i++) {
      const x = positionAttribute.array[i * 3 + 0]; // in [-halfExtent..+halfExtent]
      const y = positionAttribute.array[i * 3 + 1]; // in [0, someHeight]
      const z = positionAttribute.array[i * 3 + 2]; // in [-halfExtent..+halfExtent]

      // Map x from [-halfExtent..+halfExtent] to [0..1] => index in [0..(rowsCount - 1)]
      const indexX = Math.round((x / (halfExtent * 2) + 0.5) * (rowsCount - 1));
      const indexZ = Math.round((z / (halfExtent * 2) + 0.5) * (rowsCount - 1));

      // col-major: row = indexZ, col = indexX
      const index = indexZ + indexX * rowsCount;

      heights[index] = y;
    }

    return {
      rowsCount,
      heights,
      displacement,
    };
  }

  private createPhysics(worldModel: GLTF, world: World) {
    const displaceMentData = this.getDisplacementData(worldModel);
    const { rowsCount, heights, displacement } = displaceMentData;

    const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(
      0,
      -displacement,
      0,
    );
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = ColliderDesc.heightfield(
      rowsCount - 1,
      rowsCount - 1,
      heights,
      {
        x: this.MAP_SIZE,
        y: 1,
        z: this.MAP_SIZE,
      },
      HeightFieldFlags.FIX_INTERNAL_EDGES,
    )
      .setFriction(1)
      .setRestitution(0.2);

    world.createCollider(colliderDesc, rigidBody);
  }

  private createKintounCollider(world: World) {
    const rigidBodyDesc = RigidBodyDesc.kinematicPositionBased().setTranslation(
      0,
      -20, // out of the physics world
      0,
    );
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const halfSize = 2;

    const colliderDesc = ColliderDesc.cuboid(
      halfSize,
      this.HALF_FLOOR_THICKNESS,
      halfSize,
    )
      .setFriction(1)
      .setRestitution(0.2);
    world.createCollider(colliderDesc, rigidBody);
    return rigidBody;
  }

  private useKintoun(playerPosition: Vector3) {
    this.kintounPosition.copy(playerPosition).setY(-this.HALF_FLOOR_THICKNESS);
    this.kintounRigidBody.setTranslation(this.kintounPosition, true);
  }

  public update(state: State) {
    const { player, clock } = state;
    this.uTime.value = clock.getElapsedTime();

    const playerPosition = player.getPosition();

    const isPlayerNearEdgeX =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.x) <
      this.KINTOUN_ACTIVATION_THRESHOLD;
    const isPlayerNearEdgeZ =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.z) <
      this.KINTOUN_ACTIVATION_THRESHOLD;

    if (isPlayerNearEdgeX || isPlayerNearEdgeZ) this.useKintoun(playerPosition);
  }
}
