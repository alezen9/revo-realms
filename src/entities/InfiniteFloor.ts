import { Texture, Vector3, BufferGeometry, Mesh } from "three";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d-compat";
import { State } from "../core/Engine";
import {
  BufferAttribute,
  DataTexture,
  FloatType,
  InstancedMesh,
  Line,
  LinearFilter,
  MeshBasicMaterial,
  MeshLambertNodeMaterial,
  Object3D,
  RedFormat,
  SphereGeometry,
} from "three/webgpu";
import floor_TEMPORARY_TextureUrl from "/environment/heightmap-1024.webp?url";
import floorModelUrl from "/environment/floor.glb?url";
// import mapHeightfieldModelUrl from "/environment/model-heightmap.glb?url";
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
import Grass from "../entities/Grass";

export default class InfiniteFloorInstanced {
  private readonly HALF_FLOOR_THICKNESS = 0.3;
  private readonly MAP_SIZE = 300;
  private readonly HALF_MAP_SIZE = this.MAP_SIZE / 2;
  private readonly KINTOUN_ACTIVATION_THRESHOLD = 2;

  private heightmapTexture?: DataTexture;

  private offset = 0;

  // Mesh
  private floorTexture: Texture;
  private floor!: Mesh;

  // Physics
  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball

  // private grass: Grass;

  private uTime = uniform(0);

  constructor(state: State) {
    const { scene, world, assetManager } = state;

    (this.floorTexture = assetManager.textureLoader.load(
      floor_TEMPORARY_TextureUrl,
      (t) => {
        t.flipY = false;
      },
    )),
      (async () => {
        await Promise.all([
          assetManager.gltfLoader.loadAsync(floorModelUrl).then((model) => {
            this.floor = this.createFloorFromModel(model);
            scene.add(this.floor);
          }),
          assetManager.gltfLoader
            .loadAsync(mapHeightfieldModelUrl)
            .then((model) => {
              // const geom = new BufferGeometry();
              // const { position } = (model.scene.children[0] as Mesh).geometry
              //   .attributes;
              // geom.setAttribute("position", position);
              // const lines = new Line(
              //   geom,
              //   new MeshBasicMaterial({ color: "red" }),
              // );
              // scene.add(lines);
              // const instances = new InstancedMesh(
              //   new SphereGeometry(0.25),
              //   new MeshBasicMaterial({ color: "red" }),
              //   position.count,
              // );

              // const dummy = new Object3D();
              // for (let i = 0; i < position.count; i++) {
              //   const i3 = i * 3;
              //   const x = position.array[i3];
              //   const y = position.array[i3 + 1];
              //   const z = position.array[i + 2];
              //   dummy.position.set(x, y, z);
              //   dummy.updateMatrix();
              //   instances.setMatrixAt(i, dummy.matrix);
              // }
              // instances.instanceMatrix.needsUpdate = true;
              // scene.add(instances);

              this.createHeightmapCollider(model, world);
            }),
        ]);
      })();

    this.kintounRigidBody = this.createKintounCollider(world);

    // this.grass = new Grass(state);
  }

  private createFloorFromModel(model: GLTF) {
    const mesh = model.scene.children[0] as Mesh;
    mesh.receiveShadow = true;
    const material = this.createFloorMaterial();
    mesh.material = material;
    return mesh;
  }

  private getHeightfieldDataFromModel(model: GLTF) {
    const mesh = model.scene.children[0] as Mesh;
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

      // Map x from [-64..+64] to [0..1] => index in [0..(rowsCount - 1)]
      const indexX = Math.round((x / (halfExtent * 2) + 0.5) * (rowsCount - 1));
      const indexZ = Math.round((z / (halfExtent * 2) + 0.5) * (rowsCount - 1));

      // row-major: row = indexZ, col = indexX
      const index = indexX + indexZ * rowsCount;

      // Store the y
      heights[index] = y;
    }

    const offset = boundingBoxAttribute.max.y / 2;
    this.offset = offset;

    return { rowsCount, heights, offset };
  }

  private createHeightmapCollider(model: GLTF, world: World) {
    // 1) Extract height data
    const { rowsCount, heights, offset } =
      this.getHeightfieldDataFromModel(model);

    // 2) Create a fixed rigid body, translated by offsetY if needed
    const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(0, -offset, 0);
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    // 3) Create a DataTexture for optional GPU displacement in your shader
    this.heightmapTexture = new DataTexture(
      heights,
      rowsCount,
      rowsCount,
      RedFormat,
      FloatType,
    );
    this.heightmapTexture.minFilter = LinearFilter;
    this.heightmapTexture.magFilter = LinearFilter;
    this.heightmapTexture.generateMipmaps = false;
    this.heightmapTexture.needsUpdate = true;

    // 4) Define the Rapier collider
    //    - We pass (rows-1, cols-1) = (64, 64) for the number of "cells"
    //    - The "scale" param will map 64 => 300 units in X,Z
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
    const displacedY = texture(this.heightmapTexture!, uv).r;

    const displacedPosition = vec3(
      positionLocal.x,
      displacedY.sub(this.offset),
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

    return mix(colorSample, outsideMapColor, isOutsideMap);
  });

  private createFloorMaterial() {
    const materialNode = new MeshLambertNodeMaterial();
    // materialNode.wireframe = true;

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
