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
import { MeshLambertNodeMaterial, Texture } from "three/webgpu";
import worldModelUrl from "/environment/world.glb?url";
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
  vec2,
  vec3,
} from "three/tsl";
import { GLTF } from "three/examples/jsm/Addons.js";

export default class InfiniteFloorInstanced {
  private readonly HALF_FLOOR_THICKNESS = 0.3;
  private readonly MAP_SIZE = 256;
  private readonly HALF_MAP_SIZE = this.MAP_SIZE / 2;
  private readonly KINTOUN_ACTIVATION_THRESHOLD = 2;

  private displacementTexture = new DataTexture();
  private uDisplacement = uniform(0);

  private floor?: Mesh;

  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball

  private uTime = uniform(0);

  // DEBUG
  private uShallowWaterColor = uniform(new Color("#00ff7b"));
  private uDeepWaterColor = uniform(new Color("#26539c"));
  private uSandColor = uniform(new Color("#C2B280"));
  private uGrassColor = uniform(new Color("#004d05"));

  private perlinNoiseTexture: Texture;

  constructor(state: State) {
    const { assetManager, world, scene } = state;

    this.perlinNoiseTexture = assetManager.perlinNoiseTexture;

    assetManager.gltfLoader.load(worldModelUrl, (worldModel) => {
      this.createMapGround(worldModel, world);
      this.floor = this.createFloor();
      scene.add(this.floor);
    });

    this.kintounRigidBody = this.createKintounCollider(world);

    this.debug();
  }

  private debug() {
    const terrain = gui.addFolder("🏔️ Terrain");
    terrain.addColor(this.uShallowWaterColor, "value").name("Shallow water");
    terrain.addColor(this.uDeepWaterColor, "value").name("Deep water");
    terrain.addColor(this.uSandColor, "value").name("Sand");
    console.log(this.uGrassColor.value.getHexString());
    terrain.addColor(this.uGrassColor, "value").name("Grass");
  }

  private createFloor() {
    const geometry = new PlaneGeometry(150, 100, 1024, 1024);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, -35);
    const material = this.createFloorMaterial();
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  private upSampleDisplacement(
    baseHeights: Float32Array,
    rowsCount: number,
    factor = 2,
  ) {
    // Now upsample by factor 2 => final grid size = rowsCount * 2
    const upsampledCount = rowsCount * factor;
    const upsampledHeights = new Float32Array(upsampledCount * upsampledCount);

    // For each upsampled cell (r2, c2) => in [0..upsampledCount-1]
    // We find corresponding (rBase, cBase) in the baseHeights. We'll do a bilinear fetch.
    // - localUV in [0..1] in each cell
    // We can interpret the domain as [0..rowsCount-1] in baseHeights.

    for (let row2 = 0; row2 < upsampledCount; row2++) {
      for (let col2 = 0; col2 < upsampledCount; col2++) {
        // Map [0..upsampledCount-1] => [0..rowsCount-1] float
        const baseRowF = row2 / factor;
        const baseColF = col2 / factor;

        // floor indices
        const row0 = Math.floor(baseRowF);
        const col0 = Math.floor(baseColF);

        // clamp
        const row1 = Math.min(row0 + 1, rowsCount - 1);
        const col1 = Math.min(col0 + 1, rowsCount - 1);

        // fract
        const fracR = baseRowF - row0;
        const fracC = baseColF - col0;

        // corner values
        const i00 = row0 + col0 * rowsCount;
        const i10 = row0 + col1 * rowsCount;
        const i01 = row1 + col0 * rowsCount;
        const i11 = row1 + col1 * rowsCount;

        const h00 = baseHeights[i00];
        const h10 = baseHeights[i10];
        const h01 = baseHeights[i01];
        const h11 = baseHeights[i11];

        // bilinear interpolation
        const h0 = h00 + (h10 - h00) * fracC;
        const h1 = h01 + (h11 - h01) * fracC;
        const h = h0 + (h1 - h0) * fracR;

        const upsampledIndex = row2 + col2 * upsampledCount;
        upsampledHeights[upsampledIndex] = h;
      }
    }
    return { upsampledHeights, upsampledCount };
  }

  private getDisplacementData(worldModel: GLTF) {
    const mesh = worldModel.scene.getObjectByName("displacement") as Mesh;
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
    this.uDisplacement.value = displacement;

    const { upsampledHeights, upsampledCount } = this.upSampleDisplacement(
      heights,
      rowsCount,
      2,
    );

    return {
      rowsCount: upsampledCount,
      heights: upsampledHeights,
      displacement,
    };
  }

  private createDisplacementDataTexture(
    displaceMentData: ReturnType<typeof this.getDisplacementData>,
  ) {
    const { rowsCount, heights } = displaceMentData;
    const data = new DataTexture(
      heights,
      rowsCount,
      rowsCount,
      RedFormat,
      FloatType,
    );
    data.minFilter = LinearFilter;
    data.magFilter = LinearFilter;
    data.generateMipmaps = false;
    data.needsUpdate = true;

    this.displacementTexture.copy(data);
  }

  private createHeightfieldCollider(
    displaceMentData: ReturnType<typeof this.getDisplacementData>,
    world: World,
  ) {
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

    // 5) Finally, create the collider in Rapier
    world.createCollider(colliderDesc, rigidBody);
  }

  private createMapGround(worldModel: GLTF, world: World) {
    const displaceMentData = this.getDisplacementData(worldModel);
    this.createDisplacementDataTexture(displaceMentData);
    this.createHeightfieldCollider(displaceMentData, world);
  }

  private createKintounCollider(world: World) {
    const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(
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

  private getGrassColor = Fn(() => {
    return this.uGrassColor;
  });

  private getColorByAltitude = Fn(([noise = float(0)]) => {
    // Define the boundaries
    const waterMax = -0.1;
    const sandMin = -0.1;
    const sandMax = 0.1;
    const grassMin = 0.1;

    const blendRange = 0.01; // Overlap range for blending

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
    const grassColor = this.getGrassColor().mul(isGrass);

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

  // Clear cut
  // private getColorByAltitude = Fn(() => {
  //   const isWater = float(1.0).sub(step(-0.1, positionWorld.y));
  //   const isSand = float(1.0)
  //     .sub(step(0.1, positionWorld.y))
  //     .mul(step(-0.1, positionWorld.y));
  //   const isGrass = step(0.1, positionWorld.y);

  //   const waterColor = this.material_getWaterColor().mul(isWater);
  //   const sandColor = this.material_getSandColor().mul(isSand);
  //   const grassColor = this.getGrassColor().mul(isGrass);

  //   const finalColor = waterColor.add(sandColor).add(grassColor);

  //   return finalColor;
  // });

  private material_applyMapDisplacement = Fn(([uv = vec2(0, 0)]) => {
    const displacedY = texture(this.displacementTexture, uv).r;

    const displacedPosition = vec3(
      positionLocal.x,
      displacedY.sub(this.uDisplacement),
      positionLocal.z,
    );

    return displacedPosition;
  });

  private material_applyMapTexture = Fn(([noise = float(0)]) => {
    const edgeX = step(-this.HALF_MAP_SIZE, positionWorld.x).mul(
      step(positionWorld.x, this.HALF_MAP_SIZE),
    );
    const edgeZ = step(-this.HALF_MAP_SIZE, positionWorld.z).mul(
      step(positionWorld.z, this.HALF_MAP_SIZE),
    );
    const isOutsideMap = float(1.0).sub(edgeX.mul(edgeZ)); // Returns 1.0 if outside, 0.0 if inside

    // const outsideMapColor = color("#8FBC8B");
    const altitudeColor = this.getColorByAltitude(noise);
    const outsideMapColor = this.material_getSandColor(noise);

    return mix(altitudeColor, outsideMapColor, isOutsideMap);
  });

  private createFloorMaterial() {
    const materialNode = new MeshLambertNodeMaterial();

    // Note: zx order is on purpose
    const uv = positionWorld.zx.add(this.HALF_MAP_SIZE).div(this.MAP_SIZE);
    const clampedUV = clamp(uv, 0.0, 1.0);

    const noise = texture(this.perlinNoiseTexture, uv);

    materialNode.positionNode = this.material_applyMapDisplacement(clampedUV);
    materialNode.colorNode = this.material_applyMapTexture(noise);

    return materialNode;
  }

  private useKintoun(playerPosition: Vector3) {
    const kintounPosition = playerPosition
      .clone()
      .setY(-this.HALF_FLOOR_THICKNESS);
    this.kintounRigidBody.setTranslation(kintounPosition, true);
  }

  public update(state: State) {
    const { clock, player } = state;
    if (!this.floor || !player) return;

    this.uTime.value = clock.getElapsedTime();

    const playerPosition = player.getPosition();
    const playerYaw = player.getYaw();
    this.floor.position.x = playerPosition.x;
    this.floor.position.z = playerPosition.z;
    this.floor.rotation.y = playerYaw;

    const isPlayerNearEdgeX =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.x) <
      this.KINTOUN_ACTIVATION_THRESHOLD;
    const isPlayerNearEdgeZ =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.z) <
      this.KINTOUN_ACTIVATION_THRESHOLD;

    if (isPlayerNearEdgeX || isPlayerNearEdgeZ) this.useKintoun(playerPosition);
  }
}
