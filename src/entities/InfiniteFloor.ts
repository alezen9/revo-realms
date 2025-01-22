import {
  Texture,
  Vector3,
  Mesh,
  DataTexture,
  FloatType,
  LinearFilter,
  RedFormat,
} from "three";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d-compat";
import { State } from "../core/Engine";
import { MeshLambertNodeMaterial } from "three/webgpu";
import floor_TEMPORARY_TextureUrl from "/environment/heightmap-1024.webp?url";
import floorModelUrl from "/environment/floor.glb?url";
import mapHeightfieldModelUrl from "/environment/model-heightmap-displacements.glb?url";
import {
  clamp,
  color,
  float,
  Fn,
  mix,
  positionLocal,
  positionWorld,
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

  private floorTexture = new Texture();
  private floor!: Mesh;

  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball

  private uTime = uniform(0);

  constructor(state: State) {
    const { world } = state;

    this.loadFloorTexture(state); // temporary
    this.loadDisplacementModel(state);
    this.loadFloorModel(state);

    this.kintounRigidBody = this.createKintounCollider(world);
  }

  /**
   *
   * @param Note For best result plane should be:
   * - a square of size MAP_SIZExMAP_SIZE
   * - have only positive values for y (y>=0)
   * - be centered meaning it ranges from [-half, +half] for both x and z
   */
  private loadDisplacementModel(state: State) {
    const { assetManager, world } = state;
    assetManager.gltfLoader.load(mapHeightfieldModelUrl, (model) => {
      this.createMapCollider(model, world);
    });
  }

  private loadFloorTexture(state: State) {
    const { assetManager } = state;
    assetManager.textureLoader.load(floor_TEMPORARY_TextureUrl, (texture) => {
      texture.flipY = false;
      this.floorTexture.copy(texture);
    });
  }

  private loadFloorModel(state: State) {
    const { assetManager, scene } = state;
    assetManager.gltfLoader.load(floorModelUrl, (model) => {
      this.floor = this.createFloorFromModel(model);
      scene.add(this.floor);
    });
  }

  private createFloorFromModel(floorModel: GLTF) {
    const mesh = floorModel.scene.children[0] as Mesh;
    mesh.receiveShadow = true;
    const material = this.createFloorMaterial();
    mesh.material = material;
    return mesh;
  }

  private extractDisplacementDataFromModel(model: GLTF) {
    const mesh = model.scene.children[0] as Mesh;
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
      const index = indexX + indexZ * rowsCount;

      heights[index] = y;
    }
    this.uDisplacement.value = displacement;

    return { rowsCount, heights, displacement };
  }

  private createDisplacementDataTexture(
    displaceMentData: ReturnType<typeof this.extractDisplacementDataFromModel>,
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
    displaceMentData: ReturnType<typeof this.extractDisplacementDataFromModel>,
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

  private createMapCollider(model: GLTF, world: World) {
    const displaceMentData = this.extractDisplacementDataFromModel(model);
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

  private material_applyMapDisplacement = Fn(([uv = vec2(0, 0)]) => {
    const displacedY = texture(this.displacementTexture, uv).r;

    const displacedPosition = vec3(
      positionLocal.x,
      displacedY.sub(this.uDisplacement),
      positionLocal.z,
    );

    return displacedPosition;
  });

  private material_applyMapTexture = Fn(([uv = vec2(0, 0)]) => {
    const colorSample = texture(this.floorTexture, uv);

    const edgeX = step(-this.HALF_MAP_SIZE, positionWorld.x).mul(
      step(positionWorld.x, this.HALF_MAP_SIZE),
    );
    const edgeZ = step(-this.HALF_MAP_SIZE, positionWorld.z).mul(
      step(positionWorld.z, this.HALF_MAP_SIZE),
    );
    const isOutsideMap = float(1.0).sub(edgeX.mul(edgeZ)); // Returns 1.0 if outside, 0.0 if inside

    // Temporary
    const outsideMapColor = color("#8FBC8B");
    const insideMapColor = color("coral");

    return mix(insideMapColor, outsideMapColor, isOutsideMap);
  });

  private createFloorMaterial() {
    const materialNode = new MeshLambertNodeMaterial();
    materialNode.wireframe = true;

    // 1. Calculate the static UVs based on the rotated world position
    const uv = positionWorld.zx.add(this.HALF_MAP_SIZE).div(this.MAP_SIZE);
    const clampedUV = clamp(uv, 0.0, 1.0); // Prevent sampling outside the map

    materialNode.positionNode = this.material_applyMapDisplacement(clampedUV);
    materialNode.colorNode = this.material_applyMapTexture(clampedUV);

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

    // this.grass.update(state);

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
