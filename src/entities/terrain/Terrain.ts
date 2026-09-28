import {
  float,
  Fn,
  If,
  mix,
  normalMap,
  normalWorld,
  normalWorldGeometry,
  positionWorld,
  smoothstep,
  texture,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import {
  Color,
  DataTexture,
  FloatType,
  Group,
  LinearFilter,
  Mesh,
  NoColorSpace,
  RedFormat,
  type Node,
  Vector3,
} from "three/webgpu";
import {
  ColliderDesc,
  HeightFieldFlags,
  type RigidBody,
  RigidBodyDesc,
} from "@dimforge/rapier3d";
import { type State } from "../../Game";
import { realmConfig } from "../realmConfig";
import { VSMReceiverLambertMaterial } from "../../systems/vsm/VSMReceiverMaterials";
import { shadeGrassGround } from "../grass/GrassShading";
import { RevoColliderType } from "../../systems/physics/colliderTypes";
import {
  assets,
  debugPanel,
  eventBus,
  physicsWorld,
  stage,
  graphics,
} from "../../systems";
import { gameTime } from "../../systems/time/gameTime";
import { srgbColorTarget } from "../../systems/debug/tweakpaneColor";
import { computeMapUvByPosition } from "../../shaders/mapping";

const GRASS_GROUND_SOFTNESS = 0.25;

const uniforms = {
  uGrassGroundColor: uniform(new Color(0.25, 0.27, 0.18).convertSRGBToLinear()),
  uUnderwaterSandColor: uniform(
    new Color(0.95, 0.87, 0.68).convertSRGBToLinear(),
  ),
  uSandColor: uniform(new Color(0.9, 0.82, 0.65).convertSRGBToLinear()),
  uGrassNormalScale: uniform(1),
  uSandNormalScale: uniform(1),
  uWaterNormalScale: uniform(0.35),
  uCausticsHighlightScale: uniform(0.4),
  uCausticsUv1Scale: uniform(31.53),
  uCausticsUv2Scale: uniform(58.71),
};

type CausticsArgs = [
  mapUv: Node<"vec2">,
  waterDepth: Node<"float">,
  waterMask: Node<"float">,
];

const computeCausticsColor = Fn<CausticsArgs, Node<"vec3">>(
  ([mapUv, waterDepth, waterMask]) => {
    const causticsColor = vec3(0).toVar();

    If(waterMask, () => {
      const causticsTime = gameTime.mul(0.15);

      const causticsUv1 = mapUv
        .mul(uniforms.uCausticsUv1Scale)
        .add(vec2(causticsTime, 0))
        .fract();

      const noiseA = texture(assets.resources.noiseAtlas, causticsUv1, 1).a;

      const causticsUv2 = mapUv
        .mul(uniforms.uCausticsUv2Scale)
        .add(vec2(0, causticsTime.negate()))
        .fract();

      const noiseB = texture(assets.resources.noiseAtlas, causticsUv2, 3).a;

      const caustics = noiseA.add(noiseB);
      const causticsCubed = caustics.mul(caustics).mul(caustics);

      const depthFalloff = smoothstep(-1, 7.5, waterDepth);

      const adjustedCaustics = causticsCubed.mul(float(1).sub(depthFalloff));

      const causticsHighlightColor = vec3(0.3, 0.4, 0.5).mul(
        uniforms.uCausticsHighlightScale,
      );

      causticsColor.assign(causticsHighlightColor.mul(adjustedCaustics));
    });

    return causticsColor;
  },
);

class TerrainMaterial extends VSMReceiverLambertMaterial {
  constructor() {
    super();

    this.createMaterial();
    this.debugTerrain();
  }

  private createMaterial() {
    const worldUv = computeMapUvByPosition(positionWorld.xz);

    const mapUv = varying(worldUv);

    const terrainMapSample = texture(assets.resources.terrainMaps, mapUv);

    // LAND
    const grassMask = terrainMapSample.g;

    const grassBlend = smoothstep(0.05, 0.35, grassMask);

    this.softShadowNode = grassBlend.mul(GRASS_GROUND_SOFTNESS);

    // WATER
    const waterMask = terrainMapSample.b;
    const waterDepth = positionWorld.y.negate();

    const waterDepthBlend = smoothstep(0, 8, waterDepth);

    const waterTint = vec3(0.35, 0.45, 0.55).mul(0.65);

    const causticsColor = computeCausticsColor(mapUv, waterDepth, waterMask);

    const shallowBoost = smoothstep(0, 1.5, waterDepth);

    const sandHighlight = vec3(1, 0.9, 0.7).mul(0.1).mul(shallowBoost);

    const waterBaseColor = mix(
      uniforms.uUnderwaterSandColor,
      waterTint,
      waterDepthBlend,
    ).add(sandHighlight);

    const waterColor = waterBaseColor.add(causticsColor);

    const surfaceColor = mix(uniforms.uSandColor, waterColor, waterMask);

    // NORMAL
    const normalAoSample = texture(
      assets.resources.terrainNormAo,
      mapUv.mul(41.7),
    );

    const landNormalScale = mix(
      uniforms.uSandNormalScale,
      uniforms.uGrassNormalScale,
      grassBlend,
    );

    const normalScale = mix(
      landNormalScale,
      uniforms.uWaterNormalScale,
      waterMask,
    );

    this.normalNode = normalMap(normalAoSample.rgb, normalScale);

    this.aoNode = normalAoSample.a;

    const groundWeight = grassBlend.mul(float(1).sub(waterMask));

    const ground = shadeGrassGround({
      albedo: vec3(1).mul(uniforms.uGrassGroundColor),
      normal: normalWorld,
      geometryNormal: normalWorldGeometry,
      worldPosition: positionWorld,
    });

    this.colorNode = surfaceColor.mul(float(1).sub(groundWeight));

    this.emissiveNode = ground.color.mul(groundWeight);

    this.extraDirectSun = ground.directSun.mul(groundWeight);
  }

  private debugTerrain() {
    const folder = debugPanel.panel.addFolder({
      title: "⛰️ Terrain",
      expanded: false,
    });

    const color = folder.addFolder({
      title: "Color",
    });

    color.addBinding(
      srgbColorTarget(uniforms.uGrassGroundColor.value),
      "value",
      {
        label: "Grass ground",
        view: "color",
        color: { type: "float" },
      },
    );

    color.addBinding(srgbColorTarget(uniforms.uSandColor.value), "value", {
      label: "Sand",
      view: "color",
      color: { type: "float" },
    });

    color.addBinding(
      srgbColorTarget(uniforms.uUnderwaterSandColor.value),
      "value",
      {
        label: "Underwater sand",
        view: "color",
        color: { type: "float" },
      },
    );

    const normal = folder.addFolder({
      title: "Normal scale",
    });

    normal.addBinding(uniforms.uSandNormalScale, "value", {
      label: "Sand",
    });

    normal.addBinding(uniforms.uGrassNormalScale, "value", {
      label: "Grass",
    });

    normal.addBinding(uniforms.uWaterNormalScale, "value", {
      label: "Water",
    });

    const caustics = folder.addFolder({
      title: "Caustics",
    });

    caustics.addBinding(uniforms.uCausticsUv1Scale, "value", {
      label: "UV 1 scale",
      min: 0,
      max: 100,
      step: 0.001,
    });

    caustics.addBinding(uniforms.uCausticsUv2Scale, "value", {
      label: "UV 2 scale",
      min: 0,
      max: 100,
      step: 0.001,
    });

    caustics.addBinding(uniforms.uCausticsHighlightScale, "value", {
      label: "Highlight scale",
      min: 0,
      max: 1,
      step: 0.001,
    });
  }
}

class InnerTerrain {
  constructor(material: TerrainMaterial) {
    const innerTerrain = this.createInnerTerrain(material);

    stage.mainScene.add(innerTerrain);
  }

  private createInnerTerrain(material: TerrainMaterial) {
    const terrainMeshes = assets.resources.worldModel.scene.children.filter(
      (object): object is Mesh =>
        object instanceof Mesh &&
        object.name.startsWith("terrain-") &&
        object.name !== "terrain-outer",
    );

    let heightfieldMesh: Mesh | undefined;
    const innerTerrain = new Group();

    for (const mesh of terrainMeshes) {
      if (mesh.name === "terrain-heightfield") {
        heightfieldMesh = mesh;
      } else {
        mesh.material = material;
        mesh.geometry.computeBoundingSphere();
        mesh.geometry.computeBoundingBox();

        innerTerrain.add(mesh);
        graphics.vsmPass.registerCaster(mesh);
      }
    }

    if (!heightfieldMesh) {
      throw new Error("No heightfield");
    }

    this.createHeightfieldPhysics(heightfieldMesh);

    return innerTerrain;
  }

  private getHeightfieldData(mesh: Mesh) {
    // They are all the same.
    const displacement = mesh.geometry.attributes._displacement.array[0];

    const positionAttribute = mesh.geometry.attributes.position;

    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }

    const boundingBox = mesh.geometry.boundingBox!;

    const vertexCount = positionAttribute.count;

    const gridSize = Math.sqrt(vertexCount);

    // Half extent of the plane size.
    // Plane is a square centred at 0,0 in Blender.
    const halfExtent = boundingBox.max.x;

    const heights = new Float32Array(vertexCount);

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
      const positionOffset = vertexIndex * 3;

      const x = positionAttribute.array[positionOffset];

      const y = positionAttribute.array[positionOffset + 1];

      const z = positionAttribute.array[positionOffset + 2];

      const gridX = Math.round((x / (halfExtent * 2) + 0.5) * (gridSize - 1));

      const gridZ = Math.round((z / (halfExtent * 2) + 0.5) * (gridSize - 1));

      const heightIndex = gridZ + gridX * gridSize;

      heights[heightIndex] = y;
    }

    return {
      gridSize,
      heights,
      displacement,
    };
  }

  private createHeightmapTexture(
    gridSize: number,
    heights: Float32Array,
    displacement: number,
  ) {
    const heightmapData = new Float32Array(heights.length);

    let min = 0;
    let max = 0;

    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        const sourceZ = gridSize - 1 - z;

        const sourceX = x;

        const sourceIndex = sourceZ + sourceX * gridSize;

        const targetIndex = x + z * gridSize;

        const height = heights[sourceIndex] - displacement;

        heightmapData[targetIndex] = height;

        if (height < min) min = height;
        if (height > max) max = height;
      }
    }

    const heightmap = new DataTexture(
      heightmapData,
      gridSize,
      gridSize,
      RedFormat,
      FloatType,
    );

    heightmap.name = "terrain.heightmap";

    heightmap.colorSpace = NoColorSpace;

    heightmap.magFilter = LinearFilter;

    heightmap.minFilter = LinearFilter;

    heightmap.generateMipmaps = false;
    heightmap.needsUpdate = true;
    heightmap.userData = {
      min,
      max,
    };

    return heightmap;
  }

  private createHeightfieldPhysics(heightfieldMesh: Mesh) {
    const { gridSize, heights, displacement } =
      this.getHeightfieldData(heightfieldMesh);

    const heightmap = this.createHeightmapTexture(
      gridSize,
      heights,
      displacement,
    );

    assets.resources.heightmap.copy(heightmap);

    const colliderDesc = ColliderDesc.heightfield(
      gridSize - 1,
      gridSize - 1,
      heights,
      {
        x: realmConfig.MAP_SIZE,
        y: 1,
        z: realmConfig.MAP_SIZE,
      },
      HeightFieldFlags.FIX_INTERNAL_EDGES,
    )
      .setTranslation(0, -displacement, 0)
      .setFriction(1)
      .setRestitution(0.2);

    physicsWorld.world.createCollider(colliderDesc).userData = {
      type: RevoColliderType.Terrain,
    };

    return displacement;
  }
}

class OuterTerrain {
  private outerTerrain: Mesh;
  // Kintoun = Flying Nimbus cloud from Dragon Ball.
  private kintoun: RigidBody;
  private kintounPosition = new Vector3();

  constructor(terrainMaterial: TerrainMaterial) {
    this.outerTerrain = this.createOuterTerrainMesh();

    this.outerTerrain.material = terrainMaterial;

    this.kintoun = this.createKintoun();

    stage.mainScene.add(this.outerTerrain);

    eventBus.on("engine-render-update", this.onEngineUpdate);
  }

  private createOuterTerrainMesh() {
    const outerTerrain = assets.getMesh("terrain-outer");

    outerTerrain.geometry.computeBoundingSphere();
    outerTerrain.geometry.computeBoundingBox();

    return outerTerrain;
  }

  private createKintoun() {
    const rigidBodyDesc = RigidBodyDesc.kinematicPositionBased().setTranslation(
      0,
      -20,
      0,
    );

    const rigidBody = physicsWorld.world.createRigidBody(rigidBodyDesc);

    const halfSize = 2;

    const colliderDesc = ColliderDesc.cuboid(
      halfSize,
      realmConfig.HALF_FLOOR_THICKNESS,
      halfSize,
    )
      .setFriction(1)
      .setRestitution(0.2);

    physicsWorld.world.createCollider(colliderDesc, rigidBody).userData = {
      type: RevoColliderType.Terrain,
    };

    return rigidBody;
  }

  private positionKintounUnderPlayer(playerPosition: Vector3) {
    this.kintounPosition
      .copy(playerPosition)
      .setY(-realmConfig.HALF_FLOOR_THICKNESS);

    this.kintoun.setTranslation(this.kintounPosition, true);
  }

  private onEngineUpdate = (state: State) => {
    const { player } = state;

    const isPlayerNearEdgeX =
      realmConfig.HALF_MAP_SIZE - Math.abs(player.position.x) <
      realmConfig.KINTOUN_ACTIVATION_THRESHOLD;

    const isPlayerNearEdgeZ =
      realmConfig.HALF_MAP_SIZE - Math.abs(player.position.z) <
      realmConfig.KINTOUN_ACTIVATION_THRESHOLD;

    if (isPlayerNearEdgeX || isPlayerNearEdgeZ) {
      this.positionKintounUnderPlayer(player.position);
    }

    const outerTerrainThreshold = realmConfig.MAP_SIZE;

    const absPlayerX = Math.abs(player.position.x);

    const directionX = Math.sign(player.position.x);

    const absPlayerZ = Math.abs(player.position.z);

    const directionZ = Math.sign(player.position.z);

    const offsetX =
      absPlayerX > outerTerrainThreshold
        ? absPlayerX - outerTerrainThreshold
        : 0;

    const offsetZ =
      absPlayerZ > outerTerrainThreshold
        ? absPlayerZ - outerTerrainThreshold
        : 0;

    const nextX = offsetX * directionX;
    const nextZ = offsetZ * directionZ;
    if (
      this.outerTerrain.position.x === nextX &&
      this.outerTerrain.position.z === nextZ
    )
      return;
    this.outerTerrain.position.set(nextX, 0, nextZ);
  };
}

export class Terrain {
  constructor() {
    const terrainMaterial = new TerrainMaterial();

    new InnerTerrain(terrainMaterial);
    new OuterTerrain(terrainMaterial);
  }
}
