import {
  Vector3,
  Mesh,
  DataTexture,
  FloatType,
  LinearFilter,
  RedFormat,
  Color,
  PlaneGeometry,
} from "three";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d-compat";
import { gui, State } from "../core/Engine";
import {
  MeshLambertMaterial,
  MeshLambertNodeMaterial,
  MeshStandardMaterial,
  Texture,
} from "three/webgpu";
import worldModelUrl from "/environment/world.glb?url";
import floorTextureUrl from "/environment/floor.webp?url";
import {
  clamp,
  color,
  float,
  Fn,
  mix,
  positionLocal,
  positionWorld,
  smoothstep,
  step,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import { GLTF } from "three/examples/jsm/Addons.js";

export default class InfiniteFloorInstanced {
  private readonly HALF_FLOOR_THICKNESS = 0.3;
  private readonly MAP_SIZE = 256;
  private readonly HALF_MAP_SIZE = this.MAP_SIZE / 2;
  private readonly KINTOUN_ACTIVATION_THRESHOLD = 2;

  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball
  private kintounPosition = new Vector3();

  // DEBUG
  private uShallowWaterColor = uniform(new Color("#00ff7b"));
  private uDeepWaterColor = uniform(new Color("#26539c"));
  private uSandColor = uniform(new Color("#C2B280"));
  private uGrassColor = uniform(new Color("#004d05"));

  private perlinNoiseTexture: Texture;

  constructor(state: State) {
    const { assetManager, world, scene } = state;

    this.perlinNoiseTexture = assetManager.perlinNoiseTexture;
    const floorTexture = assetManager.textureLoader.load(floorTextureUrl);
    floorTexture.flipY = false;

    assetManager.gltfLoader.load(worldModelUrl, (worldModel) => {
      this.createPhysics(worldModel, world);
      this.createVisual(worldModel, floorTexture, scene);
    });

    this.kintounRigidBody = this.createKintounCollider(world);

    this.debug();
  }

  private debug() {
    const terrain = gui.addFolder("🏔️ Terrain");
    terrain.addColor(this.uShallowWaterColor, "value").name("Shallow water");
    terrain.addColor(this.uDeepWaterColor, "value").name("Deep water");
    terrain.addColor(this.uSandColor, "value").name("Sand");
    terrain.addColor(this.uGrassColor, "value").name("Grass");
  }

  private createVisual(
    worldModel: GLTF,
    floorTexture: Texture,
    scene: State["scene"],
  ) {
    const floor = worldModel.scene.getObjectByName("floor") as Mesh;
    floor.geometry.computeVertexNormals();
    floor.material = new MeshStandardMaterial({ map: floorTexture });
    // floor.material = this.createFloorMaterial();
    floor.receiveShadow = true;
    scene.add(floor);
  }

  private getDisplacementData(worldModel: GLTF) {
    const mesh = worldModel.scene.getObjectByName("heightfield") as Mesh;
    const displacement = mesh.geometry.attributes._displacement.array[0]; // they are all the same
    const positionAttribute = mesh.geometry.attributes.position;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const boundingBoxAttribute = mesh.geometry.boundingBox!;
    const totalCount = positionAttribute.count;
    const rowsCount = Math.sqrt(totalCount);

    // half extent of the plane size, plane is a square centred at 0,0 in Blender
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

    // const { upsampledHeights, upsampledCount } = this.upSampleDisplacement(
    //   heights,
    //   rowsCount,
    //   2,
    // );

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

  private material_getWaterColor = Fn(() => {
    const shallowDepth = float(-0.1);
    const deepDepth = float(-2);

    let finalColor = color("black");
    const factorShallow = smoothstep(deepDepth, shallowDepth, positionWorld.y);
    finalColor = finalColor.add(this.uShallowWaterColor.mul(factorShallow));
    const factorDeep = smoothstep(-10, deepDepth, positionWorld.y);
    finalColor = finalColor.add(this.uDeepWaterColor.mul(factorDeep));

    return finalColor;
  });

  private material_getSandColor = Fn(([noise = float(0)]) => {
    // Calculate a darker version of the base sand color
    const darkerSandColor = this.uSandColor.mul(float(0.8)); // Make it 20% darker (adjust as needed)

    // Interpolate between the base sand color and the darker shade using the noise value
    const finalSandColor = this.uSandColor.mix(darkerSandColor, noise);

    return finalSandColor;
  });

  private material_getGrassColor = Fn(() => {
    return this.uGrassColor;
  });

  private getColorByAltitude = Fn(([noise = float(0)]) => {
    // Define the boundaries
    const waterMax = -0.2;
    const sandMin = -0.2;
    const sandMax = 0.2;
    const grassMin = 0.2;

    const blendRange = 0.2; // Overlap range for blending

    // Calculate blending factors using smoothstep
    const isWater = float(1.0).sub(
      smoothstep(waterMax - blendRange, waterMax + blendRange, positionWorld.y),
    );
    const isSand = smoothstep(
      sandMin - blendRange,
      sandMin + blendRange,
      positionWorld.y,
    ).mul(
      float(1.0).sub(
        smoothstep(sandMax - blendRange, sandMax + blendRange, positionWorld.y),
      ),
    );
    const isGrass = smoothstep(
      grassMin - blendRange,
      grassMin + blendRange,
      positionWorld.y,
    );

    // Calculate colors with blending factors
    const waterColor = this.material_getWaterColor().mul(isWater);
    const sandColor = this.material_getSandColor(noise).mul(isSand);
    const grassColor = this.material_getGrassColor().mul(isGrass);

    // Combine blended colors
    const finalColor = waterColor.add(sandColor).add(grassColor);

    // const blendFactors = vec3(
    //   float(1.0).sub(smoothstep(-0.15, -0.05, positionWorld.y)),
    //   smoothstep(-0.15, -0.05, positionWorld.y).sub(
    //     smoothstep(0.05, 0.15, positionWorld.y),
    //   ),
    //   smoothstep(0.05, 0.15, positionWorld.y),
    // );

    // const finalColor = blendFactors.x
    //   .mul(waterColor)
    //   .add(blendFactors.y.mul(sandColor))
    //   .add(blendFactors.z.mul(grassColor));

    return finalColor;
  });

  private material_isOutsideMap = Fn(() => {
    const edgeX = step(-this.HALF_MAP_SIZE, positionWorld.x).mul(
      step(positionWorld.x, this.HALF_MAP_SIZE),
    );
    const edgeZ = step(-this.HALF_MAP_SIZE, positionWorld.z).mul(
      step(positionWorld.z, this.HALF_MAP_SIZE),
    );
    const isOutsideMap = float(1.0).sub(edgeX.mul(edgeZ)); // Returns 1.0 if outside, 0.0 if inside
    return isOutsideMap;
  });

  private material_colorizeByAltitude = Fn(() => {
    const noise = texture(this.perlinNoiseTexture, uv());

    const outsideMapColor = color("#8FBC8B");
    const altitudeColor = this.getColorByAltitude(noise);

    const isOutsideMap = this.material_isOutsideMap();

    return mix(altitudeColor, outsideMapColor, isOutsideMap);
  });

  private createFloorMaterial() {
    const materialNode = new MeshLambertNodeMaterial();
    materialNode.colorNode = this.material_colorizeByAltitude();
    return materialNode;
  }

  private useKintoun(playerPosition: Vector3) {
    this.kintounPosition.copy(playerPosition).setY(-this.HALF_FLOOR_THICKNESS);
    this.kintounRigidBody.setTranslation(this.kintounPosition, true);
  }

  public update(state: State) {
    const { player } = state;
    if (!player) return;

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
