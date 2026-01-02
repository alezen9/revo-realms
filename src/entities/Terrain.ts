import {
  float,
  Fn,
  mix,
  positionWorld,
  remap,
  smoothstep,
  texture,
  time,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { RevoColliderType } from "../types";
import {
  Color,
  DataTexture,
  FloatType,
  LinearFilter,
  Mesh,
  MeshLambertNodeMaterial,
  NoColorSpace,
  RedFormat,
  Vector3,
} from "three/webgpu";
import { assetManager } from "../systems/AssetManager/AssetManager";
import { realmConfig } from "../realms/PortfolioRealm";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
} from "@dimforge/rapier3d";
import { physicsManager } from "../systems/PhysicsManager";
import { State } from "../Game";
import { sceneManager } from "../systems/SceneManager";
import { debugManager } from "../systems/DebugManager";
import { eventsManager } from "../systems/EventsManager";
import { tslUtils } from "../utils/TSLUtils";

const uniforms = {
  uGrassTerrainColor: uniform(new Color().setRGB(0.28, 0.25, 0.0)),
  uWaterSandColor: uniform(new Color().setRGB(0.54, 0.39, 0.2)),
  uPathSandColor: uniform(new Color().setRGB(0.65, 0.49, 0.27)),
};

class TerainMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.createMaterial();
    this.debugTerrain();
  }

  private debugTerrain() {
    const folder = debugManager.panel.addFolder({
      title: "⛰️ Terrain",
      expanded: false,
    });
    folder.addBinding(uniforms.uPathSandColor, "value", {
      label: "Path color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uWaterSandColor, "value", {
      label: "Water bed color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uGrassTerrainColor, "value", {
      label: "Grass terrain color",
      view: "color",
      color: { type: "float" },
    });
  }

  private computeCausticsDiffuse = Fn(([vUv = vec2(0), vDepth = float(0)]) => {
    const timer = time.mul(0.15);
    const uv1 = vUv.mul(17).add(vec2(timer, 0)).fract();
    const noiseA = texture(assetManager.resources.noiseTexture, uv1, 1).g;
    const uv2 = vUv.mul(33).add(vec2(0, timer.negate())).fract();
    const noiseB = texture(assetManager.resources.noiseTexture, uv2, 3).g;
    const caustics = noiseA.add(noiseB);
    const caustics3 = caustics.mul(caustics).mul(caustics);
    const depthFalloff = smoothstep(-1, 7.5, vDepth);
    const adjustedCaustics = caustics3.mul(float(1).sub(depthFalloff));
    const causticsHighlightColor = vec3(0.3, 0.4, 0.5);
    const causticsShadowColor = vec3(0, 0, 0);
    return mix(causticsShadowColor, causticsHighlightColor, adjustedCaustics);
  });

  private computeWaterDiffuse = Fn(([vDepth = float(0), vUv = vec2(0, 0)]) => {
    const blendFactor = smoothstep(0, 8, vDepth);
    const waterTint = vec3(0.35, 0.45, 0.55).mul(0.65);
    const causticsColor = this.computeCausticsDiffuse(vUv, vDepth);
    const shallowBoost = smoothstep(0.0, 1.5, vDepth);
    const sandHighlight = vec3(1.0, 0.9, 0.7).mul(0.1).mul(shallowBoost);
    const waterBaseColor = mix(
      uniforms.uWaterSandColor,
      waterTint,
      blendFactor,
    ).add(sandHighlight);
    return waterBaseColor.add(causticsColor);
  });

  private createMaterial() {
    this.precision = "lowp";
    this.flatShading = false;
    const _uv = tslUtils.computeMapUvByPosition(positionWorld.xz);
    const vUv = varying(_uv);

    const shadowAo = texture(
      assetManager.resources.terrainShadowAoTexture,
      uv(),
    );

    const type = texture(assetManager.resources.terrainTypeTexture, vUv, 3.5);
    const grassFactor = type.g;
    const waterFactor = type.b;
    const sandFactor = float(1).sub(grassFactor);
    const pathFactor = sandFactor.sub(waterFactor);

    // Fake Normal
    const sandUv = vUv.mul(30);
    const sandNormal = texture(assetManager.resources.sandNormal, sandUv);

    const grassUv = vUv.mul(30);
    const grassNormal = texture(assetManager.resources.grassNormal, grassUv);
    const terrainNoise = grassNormal.dot(sandNormal).mul(0.65);

    // Diffuse
    // Grass
    const grassColorSample = texture(
      assetManager.resources.grassDiffuse,
      grassUv,
    );
    // const sandAlpha = float(1).sub(grassColorSample.a);
    // const grassColor = uniforms.uGrassTerrainColor
    //   .mul(sandAlpha)
    //   .add(grassColorSample)
    //   .mul(grassFactor)
    //   .mul(0.85);

    const noise = texture(assetManager.resources.noise2, vUv);
    const variation = remap(noise.r, 0, 1, 0.15, 1);
    const base = mix(
      uniforms.uGrassTerrainColor,
      grassColorSample.rgb,
      grassColorSample.a,
    );
    const grassColor = base.mul(variation).mul(2).mul(grassFactor);

    const pathColor = uniforms.uPathSandColor.mul(1.2).mul(pathFactor);

    // Water
    const vDepth = varying(positionWorld.y.negate());
    const waterBaseColor = this.computeWaterDiffuse(vDepth, vUv);
    const waterColor = waterBaseColor.mul(waterFactor);

    // Final diffuse
    const finalColor = grassColor
      .add(pathColor.mul(terrainNoise))
      .add(waterColor.mul(terrainNoise).mul(0.5));

    this.colorNode = finalColor.mul(shadowAo.r);

    // const height = texture(
    //   assetManager.resources.terrainHeightMap,
    //   vec2(vUv.x, float(1).sub(vUv.y)),
    // ).r;

    // this.positionNode = vec3(
    //   positionLocal.x,
    //   positionLocal.y.add(height),
    //   positionLocal.z,
    // );
  }
}

class InnerTerrain {
  constructor(material: TerainMaterial) {
    const floor = this.createFloor();
    floor.material = material;
    sceneManager.scene.add(floor);
  }

  private createFloor() {
    // Visual
    const floor = assetManager.resources.realmModel.scene.getObjectByName(
      "floor",
    ) as Mesh;
    floor.receiveShadow = true;

    // Physics
    this.createFloorPhysics();
    return floor;
  }

  private getFloorDisplacementData() {
    const mesh = assetManager.resources.realmModel.scene.getObjectByName(
      "heightfield",
    ) as Mesh;
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

  private createDisplacementTexture(
    rowsCount: number,
    heights: Float32Array,
    displacement: number,
  ) {
    const N = rowsCount;
    const fixed = new Float32Array(heights.length);

    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const srcZ = N - 1 - z;
        const srcX = x;
        const srcIndex = srcZ + srcX * N;
        const dstIndex = x + z * N;
        fixed[dstIndex] = heights[srcIndex] - displacement;
      }
    }

    const tex = new DataTexture(fixed, N, N, RedFormat, FloatType);
    tex.colorSpace = NoColorSpace;
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  private createFloorPhysics() {
    const displaceMentData = this.getFloorDisplacementData();
    const { rowsCount, heights, displacement } = displaceMentData;
    const heightMap = this.createDisplacementTexture(
      rowsCount,
      heights,
      displacement,
    );
    assetManager.resources.terrainHeightMap.copy(heightMap);

    const rigidBodyDesc = RigidBodyDesc.fixed()
      .setTranslation(0, -displacement, 0)
      .setUserData({ type: RevoColliderType.Terrain });
    const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = ColliderDesc.heightfield(
      rowsCount - 1,
      rowsCount - 1,
      heights,
      {
        x: realmConfig.MAP_SIZE,
        y: 1,
        z: realmConfig.MAP_SIZE,
      },
      HeightFieldFlags.FIX_INTERNAL_EDGES,
    )
      .setFriction(1)
      .setRestitution(0.2);

    physicsManager.world.createCollider(colliderDesc, rigidBody);
  }
}

class OuterTerrain {
  private outerFloor: Mesh;
  private kintoun: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball
  private kintounPosition = new Vector3();

  constructor(material: TerainMaterial) {
    this.outerFloor = this.createOuterFloorVisual();
    this.outerFloor.material = material;
    this.kintoun = this.createKintoun();
    sceneManager.scene.add(this.outerFloor);

    eventsManager.on("update", this.update.bind(this));
  }

  private createOuterFloorVisual() {
    const outerFloor = assetManager.resources.realmModel.scene.getObjectByName(
      "outer_world",
    ) as Mesh;
    outerFloor.receiveShadow = true;
    return outerFloor;
  }

  private createKintoun() {
    const rigidBodyDesc = RigidBodyDesc.kinematicPositionBased()
      .setTranslation(
        0,
        -20, // out of the physics world
        0,
      )
      .setUserData({ type: RevoColliderType.Terrain });
    const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);

    const halfSize = 2;

    const colliderDesc = ColliderDesc.cuboid(
      halfSize,
      realmConfig.HALF_FLOOR_THICKNESS,
      halfSize,
    )
      .setFriction(1)
      .setRestitution(0.2);
    physicsManager.world.createCollider(colliderDesc, rigidBody);
    return rigidBody;
  }

  private useKintoun(playerPosition: Vector3) {
    this.kintounPosition
      .copy(playerPosition)
      .setY(-realmConfig.HALF_FLOOR_THICKNESS);
    this.kintoun.setTranslation(this.kintounPosition, true);
  }

  private update(state: State) {
    const { player } = state;
    const isPlayerNearEdgeX =
      realmConfig.HALF_MAP_SIZE - Math.abs(player.position.x) <
      realmConfig.KINTOUN_ACTIVATION_THRESHOLD;
    const isPlayerNearEdgeZ =
      realmConfig.HALF_MAP_SIZE - Math.abs(player.position.z) <
      realmConfig.KINTOUN_ACTIVATION_THRESHOLD;

    if (isPlayerNearEdgeX || isPlayerNearEdgeZ)
      this.useKintoun(player.position);

    const outerFloorThresold = realmConfig.MAP_SIZE;
    const absPlayerX = Math.abs(player.position.x);
    const dirX = Math.sign(player.position.x);
    const absPlayerZ = Math.abs(player.position.z);
    const dirZ = Math.sign(player.position.z);

    const dx =
      absPlayerX > outerFloorThresold ? absPlayerX - outerFloorThresold : 0;
    const dz =
      absPlayerZ > outerFloorThresold ? absPlayerZ - outerFloorThresold : 0;
    this.outerFloor.position.set(dx * dirX, 0, dz * dirZ);
  }
}

export default class Terrain {
  constructor() {
    const terrainMaterial = new TerainMaterial();
    new InnerTerrain(terrainMaterial);
    new OuterTerrain(terrainMaterial);
  }
}

// export default class Terrain {
//   private group: Group;
//   private nGrid = 7;
//   private tileSize = 32;
//   private tileSizeSq = this.tileSize * this.tileSize;

//   constructor() {
//     const terrainMaterial = new TerainMaterial();
//     new InnerTerrain(terrainMaterial);
//     new OuterTerrain(terrainMaterial);

//     const geometries = [
//       new PlaneGeometry(this.tileSize, this.tileSize, 64, 64),
//       new PlaneGeometry(this.tileSize, this.tileSize, 32, 32),
//       new PlaneGeometry(this.tileSize, this.tileSize, 16, 16),
//     ];
//     geometries.forEach((g) => {
//       g.rotateX(-Math.PI / 2);
//     });

//     this.group = this.createGrid(terrainMaterial, geometries);
//     sceneManager.scene.add(this.group);

//     // snap the whole grid in integer tile steps; wrap tiles locally
//     eventsManager.on("update-throttle-2x", ({ player }) => {
//       const dx = player.position.x - this.group.position.x;
//       const dz = player.position.z - this.group.position.z;

//       // early out if we're well within the current center tile
//       if (dx * dx + dz * dz < this.tileSizeSq) return;

//       // how many whole tiles did we move since last snap?
//       const stepX = Math.round(dx / this.tileSize);
//       const stepZ = Math.round(dz / this.tileSize);
//       if (stepX === 0 && stepZ === 0) return;

//       // snap group origin by whole tiles
//       this.group.position.x += stepX * this.tileSize;
//       this.group.position.z += stepZ * this.tileSize;

//       // shift tiles opposite to movement and wrap within the grid span
//       this.wrapTiles(stepX, stepZ);
//     });
//   }

//   private createGrid(material: TerainMaterial, geometries: PlaneGeometry[]) {
//     const group = new Group();
//     const half = Math.floor(this.nGrid / 2);

//     for (let j = -half; j <= half; j++) {
//       for (let i = -half; i <= half; i++) {
//         const tile = this.createTile(material, geometries);
//         tile.position.set(i * this.tileSize, 0, j * this.tileSize);
//         group.add(tile);
//       }
//     }
//     return group;
//   }

//   private createTile(material: TerainMaterial, geometries: PlaneGeometry[]) {
//     const lod = new LOD();

//     const meshHigh = new Mesh(geometries[0], material);
//     meshHigh.receiveShadow = true;
//     lod.addLevel(meshHigh, 0);

//     const meshMid = new Mesh(geometries[1], material);
//     meshMid.receiveShadow = true;
//     lod.addLevel(meshMid, 50);

//     const meshLow = new Mesh(geometries[2], material);
//     meshLow.receiveShadow = true;
//     lod.addLevel(meshLow, 100);

//     // LOD itself doesn't receive; children do
//     return lod;
//   }

//   private wrapTiles(stepX: number, stepZ: number) {
//     const halfGrid = Math.floor(this.nGrid / 2);
//     const limit = halfGrid * this.tileSize; // max |pos| in group space
//     const span = this.nGrid * this.tileSize; // full grid width

//     for (const tile of this.group.children) {
//       // move opposite to player step
//       tile.position.x -= stepX * this.tileSize;
//       tile.position.z -= stepZ * this.tileSize;

//       // single-pass wrap (O(1)); no while
//       if (tile.position.x > limit) tile.position.x -= span;
//       else if (tile.position.x < -limit) tile.position.x += span;

//       if (tile.position.z > limit) tile.position.z -= span;
//       else if (tile.position.z < -limit) tile.position.z += span;
//     }
//   }
// }
