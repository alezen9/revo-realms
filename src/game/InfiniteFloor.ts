import {
  TextureLoader,
  Texture,
  Vector3,
  BoxGeometry,
  DataTexture,
  Mesh,
  Vector2,
  MeshLambertMaterial,
} from "three";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d-compat";
import { State } from "../core/Engine";
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  MeshLambertNodeMaterial,
  PlaneGeometry,
} from "three/webgpu";
import heightmapTextureUrlExr from "/environment/heightmap3-128.exr?url";
import floorTextureUrl from "/environment/map2-1024.webp?url";
import floorModelUrl from "/environment/floor.glb?url";
import {
  clamp,
  dFdx,
  dFdy,
  float,
  greaterThan,
  lessThan,
  mix,
  normalize,
  or,
  positionLocal,
  rotate,
  ShaderNodeObject,
  step,
  texture,
  uniform,
  vec3,
} from "three/tsl";
import {
  DRACOLoader,
  EXRLoader,
  GLTF,
  GLTFLoader,
} from "three/examples/jsm/Addons.js";
import Grass from "./Grass";

export default class InfiniteFloorInstanced {
  private readonly HALF_FLOOR_THICKNESS = 0.3;
  private readonly MAP_SIZE = 300;
  private readonly HALF_MAP_SIZE = this.MAP_SIZE / 2;
  private readonly KINTOUN_ACTIVATION_THRESHOLD = 2;

  // Mesh
  private floorTexture: Texture;
  private floor!: Mesh;

  // Physics
  // private mapRigidBody: RigidBody;
  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball

  private heightmapTexture: DataTexture;

  private grass: Grass;

  private uTime = uniform(0);
  private uWorldYaw = uniform(0);
  private uWorldPos = uniform(new Vector2());

  constructor(state: State) {
    const { scene, world } = state;

    const loader = new TextureLoader();
    this.floorTexture = loader.load(floorTextureUrl, (t) => {
      t.flipY = false;
    });

    const exrLoader = new EXRLoader();
    this.heightmapTexture = exrLoader.load(heightmapTextureUrlExr, (t, d) => {
      t.flipY = true;
      this.createMapHeightfieldCollider(world);
    });
    this.heightmapTexture.magFilter = LinearFilter;
    this.heightmapTexture.minFilter = LinearMipmapLinearFilter;
    this.heightmapTexture.generateMipmaps = true;

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load(floorModelUrl, (model) => {
      this.floor = this.createFloorFromModel(model);
      scene.add(this.floor);
    });

    // this.createMapCollider(world);
    this.kintounRigidBody = this.createKintounCollider(world);

    this.grass = new Grass(state);

    const cube = new Mesh(
      new BoxGeometry(),
      new MeshLambertMaterial({ color: "blue" }),
    );
    cube.position.y = 0.5;
    scene.add(cube);

    // const planeGeom = new PlaneGeometry();
    // planeGeom.rotateX(-Math.PI / 2);
    // const plane = new Mesh(
    //   planeGeom,
    //   new MeshLambertMaterial({ color: "blue" }),
    // );
    // this.heightmapScaleXZ = 300;
    // const scale = this.heightmapScaleXZ;
    // plane.scale.copy(new Vector3(scale, scale, scale));
    // scene.add(plane);
  }

  private createFloorFromModel(model: GLTF) {
    const mesh = model.scene.children[0] as Mesh;
    mesh.receiveShadow = true;
    const material = this.createFloorMaterial();
    mesh.material = material;
    return mesh;
  }

  // works well with 64x64 texture
  // private getDataFromDisplacementMap() {
  //   const { width, height, data } = this.heightmapTexture.image;

  //   const minValue = Math.min(...data);
  //   const maxValue = Math.max(...data);

  //   const heights = new Float32Array(width * height);

  //   for (let row = 0; row < height; row++) {
  //     for (let col = 0; col < width; col++) {
  //       const i = row * width + col;
  //       // Clamp the edge values to avoid warping
  //       if (row === 0 || row === height - 1 || col === 0 || col === width - 1) {
  //         heights[i] = 0; // Set edges flat
  //         continue;
  //       }

  //       // no flipping
  //       // const i4 = (row * width + col) * 4;

  //       // flip x
  //       // const i4 = (row * width + (width - 1 - col)) * 4;

  //       // flip y
  //       // const i4 = ((height - 1 - row) * width + col) * 4;

  //       // flip both x and y
  //       // const flippedRow = height - 1 - row;
  //       // const flippedCol = width - 1 - col;
  //       // const i4 = (flippedRow * width + flippedCol) * 4;

  //       // clockwise rotation 90deg
  //       // const i4 = (col * height + (height - 1 - row)) * 4;

  //       // counterclockwise rotation 90deg
  //       const i4 = ((width - 1 - col) * height + row) * 4;

  //       const rawValue = data[i4]; // Red channel

  //       // Normalize and map to [-1, 1]
  //       const normalizedValue = (rawValue - minValue) / (maxValue - minValue);
  //       // const displacementValue = normalizedValue * 2.0 - 1.0;
  //       const displacementValue = MathUtils.mapLinear(
  //         rawValue,
  //         minValue,
  //         maxValue,
  //         -0.5,
  //         0.5,
  //       );
  //       const compressed =
  //         displacementValue < 0
  //           ? MathUtils.mapLinear(displacementValue, -0.5, 0, -0.25, 0)
  //           : displacementValue;

  //       heights[i] = compressed;
  //     }
  //   }

  //   console.log("Min Height:", Math.min(...heights));
  //   console.log("Max Height:", Math.max(...heights));

  //   return { heights, width, height };
  // }

  private getDataFromDisplacementMap() {
    const { width, height, data } = this.heightmapTexture.image;

    const minValue = Math.min(...data);
    const maxValue = Math.max(...data);

    const heights = new Float32Array(width * height);

    let totalHeight = 0;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const i = row * width + col;
        // Clamp the edge values to avoid warping
        if (row === 0 || row === height - 1 || col === 0 || col === width - 1) {
          heights[i] = 0; // Set edges flat
          continue;
        }

        // no flipping
        // const i4 = (row * width + col) * 4;

        // flip x
        // const i4 = (row * width + (width - 1 - col)) * 4;

        // flip y
        // const i4 = ((height - 1 - row) * width + col) * 4;

        // flip both x and y
        // const flippedRow = height - 1 - row;
        // const flippedCol = width - 1 - col;
        // const i4 = (flippedRow * width + flippedCol) * 4;

        // clockwise rotation 90deg
        // const i4 = (col * height + (height - 1 - row)) * 4;

        // counterclockwise rotation 90deg
        const i4 = ((width - 1 - col) * height + row) * 4;

        const rawValue = data[i4]; // Red channel

        // Normalize and map to [-1, 1]
        const normalizedValue = (rawValue - minValue) / (maxValue - minValue);
        // const displacementValue = normalizedValue * 2.0 - 1.0;
        const displacementValue = MathUtils.mapLinear(
          rawValue,
          minValue,
          maxValue,
          -0.5,
          0.5,
        );
        const compressed =
          displacementValue < 0
            ? MathUtils.mapLinear(displacementValue, -0.5, 0, -0.25, 0)
            : displacementValue;

        heights[i] = compressed;
        totalHeight += compressed;
      }
    }

    const averageHeight = totalHeight / heights.length;

    console.log("Min Height:", Math.min(...heights));
    console.log("Max Height:", Math.max(...heights));

    return { heights, width, height, averageHeight };
  }

  private createMapHeightfieldCollider(world: World) {
    const { heights, width, height, averageHeight } =
      this.getDataFromDisplacementMap();

    const nrows = height - 1;
    const ncols = width - 1;
    // const scaleXZ = this.MAP_SIZE - 5;
    const scaleXZ = (this.MAP_SIZE * (width - 1)) / width;

    const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(
      0,
      -averageHeight * 20,
      0,
    );
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = ColliderDesc.heightfield(
      nrows,
      ncols,
      heights,
      {
        x: scaleXZ,
        y: 20,
        z: scaleXZ,
      },
      HeightFieldFlags.FIX_INTERNAL_EDGES,
    )
      .setFriction(1)
      .setRestitution(0.2);

    world.createCollider(colliderDesc, rigidBody);
  }

  private createMapCollider(world: World) {
    const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(
      0,
      -this.HALF_FLOOR_THICKNESS,
      0,
    );
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const halfMapSize = this.MAP_SIZE / 2;

    const colliderDesc = ColliderDesc.cuboid(
      halfMapSize,
      this.HALF_FLOOR_THICKNESS,
      halfMapSize,
    )
      .setFriction(1)
      .setRestitution(0.2);
    world.createCollider(colliderDesc, rigidBody);
    return rigidBody;
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

  private createFloorMaterial() {
    const materialNode = new MeshLambertNodeMaterial();

    // Position
    const unrotatedPosition = rotate(positionLocal, vec3(0, this.uWorldYaw, 0));
    const absoluteXZ = unrotatedPosition.xz.add(this.uWorldPos);
    const uv = absoluteXZ.add(this.HALF_MAP_SIZE).div(this.MAP_SIZE);
    const clampedUV = clamp(uv, 0.0, 1.0);

    const edgeX = step(float(-this.HALF_MAP_SIZE), absoluteXZ.x).mul(
      step(absoluteXZ.x, float(this.HALF_MAP_SIZE)),
    );
    const edgeY = step(float(-this.HALF_MAP_SIZE), absoluteXZ.y).mul(
      step(absoluteXZ.y, float(this.HALF_MAP_SIZE)),
    );
    const isOutsideMap = float(1.0).sub(edgeX.mul(edgeY)); // 1 if outside, 0 if inside

    const heightmapNode = texture(this.heightmapTexture, clampedUV);
    const heightValue = heightmapNode.r;
    const scaleY = 20; // Arbitrary, how much to stretch ups and downs on the y axis

    const displacedY = mix(-scaleY / 2.0, scaleY / 2.0, heightValue);

    const displacedPosition = vec3(
      positionLocal.x,
      displacedY,
      positionLocal.z,
    );

    materialNode.positionNode = displacedPosition;

    const colorSample = texture(this.floorTexture, clampedUV);

    materialNode.colorNode = mix(
      colorSample.rgb,
      vec3(0.0, 1.0, 0.0),
      isOutsideMap,
    );

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

    this.grass.update(state);

    this.uTime.value = clock.getElapsedTime();

    const playerPosition = player.getPosition();
    const playerYaw = player.getYaw();
    this.floor.position.x = playerPosition.x;
    this.floor.position.z = playerPosition.z;
    this.floor.rotation.y = playerYaw;

    this.uWorldPos.value.set(playerPosition.x, playerPosition.z);
    this.uWorldYaw.value = -playerYaw;

    const isPlayerNearEdgeX =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.x) <
      this.KINTOUN_ACTIVATION_THRESHOLD;
    const isPlayerNearEdgeZ =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.z) <
      this.KINTOUN_ACTIVATION_THRESHOLD;

    if (isPlayerNearEdgeX || isPlayerNearEdgeZ) this.useKintoun(playerPosition);
  }
}
