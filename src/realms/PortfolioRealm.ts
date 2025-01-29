import {
  Vector3,
  Mesh,
  MeshBasicMaterial,
  Vector2,
  PlaneGeometry,
  RepeatWrapping,
  MeshPhongMaterial,
  Color,
  BoxGeometry,
  CubeTexture,
  LinearFilter,
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
  MeshPhysicalNodeMaterial,
  MeshStandardMaterial,
  Texture,
} from "three/webgpu";
import worldModelUrl from "/environment/world.glb?url";
import floorTextureUrl from "/environment/floor.webp?url";
import { GLTF } from "three/examples/jsm/Addons.js";
import { debugManager } from "../systems/DebugManager";
import waterTextureUrl from "/water_pool_texture.webp?url";

import {
  add,
  cameraPosition,
  clamp,
  color,
  cos,
  cross,
  cubeTexture,
  distance,
  dot,
  float,
  floor,
  Fn,
  fract,
  hash,
  length,
  linearDepth,
  Loop,
  max,
  mix,
  modelPosition,
  modelWorldMatrix,
  mul,
  mx_worley_noise_float,
  normalize,
  normalLocal,
  positionGeometry,
  positionLocal,
  positionWorld,
  pow,
  reflect,
  screenUV,
  sin,
  smoothstep,
  step,
  sub,
  texture,
  textureCubeUV,
  uniform,
  uv,
  varying,
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

  // Water
  private uTime = uniform(0);
  private uWavesSpeed = uniform(0.01);
  private uOpacity = uniform(0.25);
  private uEnvironmentMap = new CubeTexture();
  private uWavesAmplitude = uniform(0.08);
  private uWavesFrequency = uniform(0.2);
  private uWavesPersistence = uniform(0.1);
  private uWavesLacunarity = uniform(1.7);
  private uWavesIterations = uniform(8);
  private uTroughColor = uniform(new Color("#186691"));
  private uSurfaceColor = uniform(new Color("#9bd8c0"));
  private uPeakColor = uniform(new Color("#bbd8e0"));
  private uPeakThreshold = uniform(0.5);
  private uPeakTransition = uniform(0.05);
  private uTroughThreshold = uniform(-0.01);
  private uTroughTransition = uniform(0.15);
  private uFresnelScale = uniform(0.8);
  private uFresnelPower = uniform(0.5);

  constructor(
    state: Pick<State, "world" | "scene" | "environmentalIllumination">,
  ) {
    const { world, scene, environmentalIllumination } = state;

    this.uEnvironmentMap.copy(environmentalIllumination.environmentMap);

    assetManager.gltfLoader.load(worldModelUrl, (worldModel) => {
      this.createPhysics(worldModel, world);
      this.createVisual(worldModel, scene);
    });

    this.kintounRigidBody = this.createKintounCollider(world);
  }

  private createVisual(worldModel: GLTF, scene: State["scene"]) {
    const floorTexture = assetManager.textureLoader.load(floorTextureUrl);
    floorTexture.flipY = false;

    const floor = worldModel.scene.getObjectByName("floor") as Mesh;
    floor.geometry.computeVertexNormals();
    floor.material = new MeshStandardMaterial({ map: floorTexture });
    floor.receiveShadow = true;
    scene.add(floor);

    const lake = worldModel.scene.getObjectByName("lake") as Mesh;
    const waterMaterial = this.createWaterMaterial();
    lake.material = waterMaterial;
    scene.add(lake);

    debugManager.panel.addBinding(waterMaterial, "wireframe", {
      label: "Wireframe",
    });

    this.debugWater();
    this.debugWaterColor();
    this.debugFresnel();
  }

  private debugWater() {
    const wavesFolder = debugManager.panel.addFolder({ title: "Waves" });
    wavesFolder.addBinding(this.uWavesAmplitude, "value", {
      min: 0,
      max: 0.1,
      label: "Amplitude",
    });
    wavesFolder.addBinding(this.uWavesFrequency, "value", {
      min: 0.1,
      max: 10,
      label: "Frequency",
    });
    wavesFolder.addBinding(this.uWavesPersistence, "value", {
      min: 0,
      max: 1,
      label: "Persistence",
    });
    wavesFolder.addBinding(this.uWavesLacunarity, "value", {
      min: 0,
      max: 3,
      label: "Lacunarity",
    });
    wavesFolder.addBinding(this.uWavesIterations, "value", {
      min: 1,
      max: 10,
      step: 1,
      label: "Iterations",
    });
    wavesFolder.addBinding(this.uWavesSpeed, "value", {
      min: 0,
      max: 1,
      label: "Speed",
    });
  }

  private debugWaterColor() {
    // Color
    const colorFolder = debugManager.panel.addFolder({ title: "Color" });

    colorFolder.addBinding(this.uOpacity, "value", {
      min: 0,
      max: 1,
      step: 0.01,
      label: "Opacity",
    });

    colorFolder.addBinding(this.uTroughColor, "value", {
      label: "Trough Color",
      view: "color",
      color: { type: "float" },
    });
    colorFolder.addBinding(this.uSurfaceColor, "value", {
      label: "Surface Color",
      view: "color",
      color: { type: "float" },
    });
    colorFolder.addBinding(this.uPeakColor, "value", {
      label: "Peak Color",
      view: "color",
      color: { type: "float" },
    });
    colorFolder.addBinding(this.uPeakThreshold, "value", {
      min: 0,
      max: 0.5,
      label: "Peak Threshold",
    });
    colorFolder.addBinding(this.uPeakTransition, "value", {
      min: 0,
      max: 0.5,
      label: "Peak Transition",
    });
    colorFolder.addBinding(this.uTroughThreshold, "value", {
      min: -0.5,
      max: 0,
      label: "Trough Threshold",
    });
    colorFolder.addBinding(this.uTroughTransition, "value", {
      min: 0,
      max: 0.5,
      label: "Trough Transition",
    });
  }

  private debugFresnel() {
    // Fresnel
    const fresnelFolder = debugManager.panel.addFolder({ title: "Fresnel" });
    fresnelFolder.addBinding(this.uFresnelScale, "value", {
      min: 0,
      max: 1,
      label: "Scale",
    });
    fresnelFolder.addBinding(this.uFresnelPower, "value", {
      min: 0,
      max: 3,
      label: "Power",
    });
  }

  private snoise2d = Fn(([p = vec2(0, 0)]) => {
    const K1 = float(0.366025404); // (sqrt(3)-1)/2;
    const K2 = float(0.211324865); // (3-sqrt(3))/6;

    const i = floor(p.add(p.x.add(p.y).mul(K1)));
    const a = p.sub(i).add(i.x.add(i.y).mul(K2));
    const m = step(a.y, a.x);
    const o = vec2(m, float(1).sub(m));
    const b = a.sub(o).add(K2);
    const c = a.sub(1).add(float(2).mul(K2));
    const h = max(float(0.5).sub(vec3(dot(a, a), dot(b, b), dot(c, c))), 0);
    const n = h
      .mul(h)
      .mul(h)
      .mul(h)
      .mul(
        vec3(dot(a, hash(i)), dot(b, hash(i.add(o))), dot(c, hash(i.add(1)))),
      );
    return dot(n, vec3(70));
  });

  private getElevation = Fn(([pos = vec2(0, 0)]) => {
    let elevation = float(0.0);
    let amplitude = float(1.0);
    let frequency = float(0);
    frequency = frequency.add(this.uWavesFrequency);

    // const waterTexture = assetManager.textureLoader.load(waterTextureUrl);

    const waterTexture = assetManager.voronoiNoiseTexture;
    const timer = this.uTime.mul(this.uWavesSpeed);

    // const _uv = fract(pos.mul(frequency.mul(0.01)).add(timer));
    const _uv = fract(pos.mul(frequency.mul(0.01)).add(timer.mul(0.1)));

    const noiseValue = texture(waterTexture, _uv).r;
    elevation = elevation.add(amplitude.mul(noiseValue));
    elevation = elevation.mul(this.uWavesAmplitude);
    amplitude = amplitude.mul(this.uWavesPersistence);
    frequency = frequency.mul(this.uWavesLacunarity);

    const _uv2 = fract(pos.mul(frequency.mul(0.01)).add(timer.mul(0.1)));
    const noiseValue2 = texture(waterTexture, _uv2).r;
    elevation = elevation.add(amplitude.mul(noiseValue2));
    elevation = elevation.mul(this.uWavesAmplitude);
    amplitude = amplitude.mul(this.uWavesPersistence);
    frequency = frequency.mul(this.uWavesLacunarity);

    const _uv3 = fract(pos.mul(frequency.mul(0.01)).add(timer.mul(0.1)));
    const noiseValue3 = texture(waterTexture, _uv3).r;
    elevation = elevation.add(amplitude.mul(noiseValue3));
    elevation = elevation.mul(this.uWavesAmplitude);
    amplitude = amplitude.mul(this.uWavesPersistence);
    frequency = frequency.mul(this.uWavesLacunarity);

    const _uv4 = fract(pos.mul(frequency.mul(0.01)).add(timer.mul(0.1)));
    const noiseValue4 = texture(waterTexture, _uv4).r;
    elevation = elevation.add(amplitude.mul(noiseValue4));
    elevation = elevation.mul(this.uWavesAmplitude);
    amplitude = amplitude.mul(this.uWavesPersistence);
    frequency = frequency.mul(this.uWavesLacunarity);

    // const _uv5 = fract(pos.mul(frequency.mul(0.01)).add(timer.mul(0.1)));
    // const noiseValue5 = texture(waterTexture, _uv5).r;
    // elevation = elevation.add(amplitude.mul(noiseValue5));
    // elevation = elevation.mul(this.uWavesAmplitude);
    // amplitude = amplitude.mul(this.uWavesPersistence);
    // frequency = frequency.mul(this.uWavesLacunarity);

    // const _uv6 = fract(pos.mul(frequency.mul(0.01)).add(timer.mul(0.1)));
    // const noiseValue6 = texture(waterTexture, _uv6).r;
    // elevation = elevation.add(amplitude.mul(noiseValue6));
    // elevation = elevation.mul(this.uWavesAmplitude);
    // amplitude = amplitude.mul(this.uWavesPersistence);
    // frequency = frequency.mul(this.uWavesLacunarity);

    // const _uv7 = fract(pos.mul(frequency.mul(0.01)).add(timer.mul(0.1)));
    // const noiseValue7 = texture(waterTexture, _uv7).r;
    // elevation = elevation.add(amplitude.mul(noiseValue7));
    // elevation = elevation.mul(this.uWavesAmplitude);
    // amplitude = amplitude.mul(this.uWavesPersistence);
    // frequency = frequency.mul(this.uWavesLacunarity);

    // const _uv8 = fract(pos.mul(frequency.mul(0.01)).add(timer.mul(0.1)));
    // const noiseValue8 = texture(waterTexture, _uv8).r;
    // elevation = elevation.add(amplitude.mul(noiseValue8));
    // elevation = elevation.mul(this.uWavesAmplitude);
    // amplitude = amplitude.mul(this.uWavesPersistence);
    // frequency = frequency.mul(this.uWavesLacunarity);

    return elevation;
  });

  private createWaterMaterial() {
    const materialNode = new MeshBasicNodeMaterial();
    materialNode.transparent = true;

    // Position
    const elevation = this.getElevation(uv());
    const position = vec3(
      positionLocal.x,
      positionLocal.y.add(elevation),
      positionLocal.z,
    );
    const vPosition = varying(position, "vPosition");

    // Normal
    const eps = float(0.001);
    const tangent = normalize(
      vec3(
        eps,
        this.getElevation(vec2(positionLocal.x.sub(eps), positionLocal.z)).sub(
          elevation,
        ),
        0.0,
      ),
    );
    const bitangent = normalize(
      vec3(
        0.0,
        this.getElevation(vec2(positionLocal.x, positionLocal.z.sub(eps))).sub(
          elevation,
        ),
        eps,
      ),
    );
    const objectNormal = normalize(cross(tangent, bitangent));
    const vNormal = varying(objectNormal, "vNormal");

    // Calculate vector from camera to the vertex
    const viewDirection = normalize(vPosition.sub(cameraPosition));
    let reflectedDirection = reflect(viewDirection, vNormal);
    reflectedDirection.x = reflectedDirection.x.negate();

    // Sample environment map to get the reflected color
    const reflectionColor = cubeTexture(
      this.uEnvironmentMap,
      reflectedDirection,
    );

    // Calculate fresnel effect
    const fresnel = this.uFresnelScale.mul(
      pow(
        float(1.0).sub(clamp(dot(viewDirection, vNormal), 0.0, 1.0)),
        this.uFresnelPower,
      ),
    );

    // Calculate transition factors using smoothstep
    const peakFactor = smoothstep(
      this.uPeakThreshold.sub(this.uPeakTransition),
      this.uPeakThreshold.add(this.uPeakTransition),
      vPosition.y,
    );
    const troughFactor = smoothstep(
      this.uTroughThreshold.sub(this.uTroughTransition),
      this.uTroughThreshold.add(this.uTroughTransition),
      vPosition.y,
    );

    // Mix between trough and surface colors based on trough transition
    const mixedColor1 = mix(
      this.uTroughColor,
      this.uSurfaceColor,
      troughFactor,
    );

    // Mix between surface and peak colors based on peak transition
    const mixedColor2 = mix(mixedColor1, this.uPeakColor, peakFactor);

    // Mix the final color with the reflection color
    const finalColor = mix(mixedColor2, reflectionColor.rgb, fresnel);

    const distanceXZ = length(positionWorld.xz.sub(cameraPosition.xz));
    const minDist = 10.0; // Minimum distance (fully transparent at this distance)
    const maxDist = 100.0; // Maximum distance (fully opaque at this distance)

    const opacity = mix(0, 1, smoothstep(minDist, maxDist, distanceXZ));

    const waterColor = vec4(finalColor, opacity);

    materialNode.colorNode = waterColor;

    materialNode.positionNode = position;

    return materialNode;
  }

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
