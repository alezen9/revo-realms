import {
  TextureLoader,
  Texture,
  Vector3,
  BoxGeometry,
  DataTexture,
  Mesh,
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
import heightmapTextureUrlExr from "/environment/heightmap-128.exr?url";
import floorTextureUrl from "/environment/map-render-1024.webp?url";
import floorModelUrl from "/environment/floor.glb?url";
import {
  clamp,
  float,
  mix,
  positionLocal,
  positionWorld,
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
  private readonly MAP_SCALE_Y = 20;

  // Mesh
  private floorTexture: Texture;
  private floor!: Mesh;

  // Physics
  // private mapRigidBody: RigidBody;
  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball

  private heightmapTexture: DataTexture;

  private grass: Grass;

  private uTime = uniform(0);

  constructor(state: State) {
    const { scene, world } = state;

    const loader = new TextureLoader();
    this.floorTexture = loader.load(floorTextureUrl, (t) => {
      t.flipY = false;
    });

    const exrLoader = new EXRLoader();
    this.heightmapTexture = exrLoader.load(heightmapTextureUrlExr, (t, d) => {
      t.minFilter = LinearFilter;
      t.magFilter = LinearFilter;
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

    const planeGeom = new PlaneGeometry(1, 1, 32, 32);
    planeGeom.rotateX(-Math.PI / 2);
    const plane = new Mesh(
      planeGeom,
      new MeshLambertMaterial({ color: "blue", wireframe: true }),
    );
    plane.position.y = 0.1;
    const scale = 300;
    plane.scale.copy(new Vector3(scale, scale, scale));
    scene.add(plane);
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

  //       heights[i] = displacementValue;
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

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const i = row * width + col;

        // counterclockwise rotation 90deg
        const i4 = ((width - 1 - col) * height + row) * 4;

        const rawValue = data[i4]; // Red channel

        const scaleY = 20;

        const displacementValue = MathUtils.mapLinear(
          rawValue,
          minValue,
          maxValue,
          -10,
          10,
        );

        heights[i] = displacementValue;

        // // Normalize from 0-65535 to 0-1 for 16-bit EXR
        // const normalizedValue = rawValue / 65535;

        // // Map to -scaleY/2 to +scaleY/2
        // const displacementValue = (normalizedValue - 0.5) * scaleY;

        // heights[i] = displacementValue;
      }
    }

    console.log(Math.min(...heights), Math.max(...heights));

    return { heights, width, height };
  }

  private createMapHeightfieldCollider(world: World) {
    const { heights, width, height } = this.getDataFromDisplacementMap();

    const nrows = height - 1;
    const ncols = width - 1;

    const scaleXZ = this.MAP_SIZE;
    const scaleY = 20; // Same as material

    const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(
      0,
      -scaleY / 2,
      0,
    );
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = ColliderDesc.heightfield(
      nrows,
      ncols,
      heights,
      {
        x: scaleXZ,
        y: scaleY / 2,
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

    // 1. Calculate the static UVs based on the rotated world position
    const uv = positionWorld.xz.add(this.HALF_MAP_SIZE).div(this.MAP_SIZE);
    const clampedUV = clamp(uv, 0.0, 1.0); // Prevent sampling outside the map

    // 2. Sample the heightmap at the correct position
    const heightmapSample = texture(this.heightmapTexture, clampedUV);
    const heightValue = heightmapSample.r;

    // 3. Apply displacement centered around zero
    const displacedY = mix(
      -this.MAP_SCALE_Y / 2.0,
      this.MAP_SCALE_Y / 2.0,
      heightValue,
    );

    // 4. Set the displaced position to update the floor shape
    const displacedPosition = vec3(
      positionLocal.x,
      displacedY,
      positionLocal.z,
    );

    materialNode.positionNode = displacedPosition;

    // 5. Sample the color texture in sync with the heightmap
    const colorSample = texture(this.floorTexture, clampedUV);

    // 6. Set color node based on inside / outside of the map
    const edgeX = step(-this.HALF_MAP_SIZE, positionWorld.x).mul(
      step(positionWorld.x, this.HALF_MAP_SIZE),
    );
    const edgeZ = step(-this.HALF_MAP_SIZE, positionWorld.z).mul(
      step(positionWorld.z, this.HALF_MAP_SIZE),
    );
    const isOutsideMap = float(1.0).sub(edgeX.mul(edgeZ)); // Returns 1.0 if outside, 0.0 if inside

    materialNode.colorNode = mix(
      colorSample.rgb,
      vec3(0.0, 0.0, 1.0),
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

    const isPlayerNearEdgeX =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.x) <
      this.KINTOUN_ACTIVATION_THRESHOLD;
    const isPlayerNearEdgeZ =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.z) <
      this.KINTOUN_ACTIVATION_THRESHOLD;

    if (isPlayerNearEdgeX || isPlayerNearEdgeZ) this.useKintoun(playerPosition);
  }
}
