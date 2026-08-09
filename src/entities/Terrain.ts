import {
  float,
  Fn,
  If,
  mix,
  normalMap,
  positionWorld,
  smoothstep,
  texture,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { RevoColliderType } from "../types";
import {
  Color,
  DataTexture,
  FloatType,
  Group,
  LinearFilter,
  Mesh,
  MeshLambertNodeMaterial,
  NoColorSpace,
  RedFormat,
  type Node,
  Vector3,
} from "three/webgpu";
import { realmConfig } from "../realm/config";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
} from "@dimforge/rapier3d";
import { type State } from "../Game";
import { gameTime } from "../utils/GameTime";
import { TSLUtils } from "../utils/TSLUtils";
import { srgbColorTarget } from "../utils/TweakpaneColor";
import {
  assetManager,
  debugManager,
  lightingManager,
  sceneManager,
  physicsManager,
  eventsManager,
} from "../systems";

const uniforms = {
  uGrassTerrainColor: uniform(
    new Color(0.62, 0.68, 0.38).convertSRGBToLinear(),
  ),
  uWaterSandColor: uniform(new Color(0.95, 0.87, 0.68).convertSRGBToLinear()),
  uTerrainColor: uniform(new Color(0.9, 0.82, 0.65).convertSRGBToLinear()),
  uGrassNormalScale: uniform(2),
  uTerrainNormalScale: uniform(1),
  uWaterNormalScale: uniform(0.35),
  uCausticsHighlightScale: uniform(0.4),
  uCausticsUv1Scale: uniform(31.53),
  uCausticsUv2Scale: uniform(58.71),
};

type CausticsArgs = [
  vUv: Node<"vec2">,
  depth: Node<"float">,
  isWater: Node<"float">,
];

const computeCausticsColor = Fn<CausticsArgs, Node<"vec3">>(
  ([vUv, depth, isWater]) => {
    const causticsColor = vec3(0).toVar();

    If(isWater, () => {
      const timer = gameTime.mul(0.15);
      const uv1 = vUv
        .mul(uniforms.uCausticsUv1Scale)
        .add(vec2(timer, 0))
        .fract();
      const noiseA = texture(assetManager.resources.noiseAtlas, uv1, 1).a;
      const uv2 = vUv
        .mul(uniforms.uCausticsUv2Scale)
        .add(vec2(0, timer.negate()))
        .fract();
      const noiseB = texture(assetManager.resources.noiseAtlas, uv2, 3).a;
      const caustics = noiseA.add(noiseB);
      const caustics3 = caustics.mul(caustics).mul(caustics);
      const depthFalloff = smoothstep(-1, 7.5, depth);
      const adjustedCaustics = caustics3.mul(float(1).sub(depthFalloff));
      const causticsHighlightColor = vec3(0.3, 0.4, 0.5).mul(
        uniforms.uCausticsHighlightScale,
      );
      causticsColor.assign(causticsHighlightColor.mul(adjustedCaustics));
    });

    return causticsColor;
  },
);

class TerrainMaterial extends MeshLambertNodeMaterial {
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

    const color = folder.addFolder({ title: "Color" });
    color.addBinding(srgbColorTarget(uniforms.uTerrainColor.value), "value", {
      label: "Terrain",
      view: "color",
      color: { type: "float" },
    });
    color.addBinding(
      srgbColorTarget(uniforms.uGrassTerrainColor.value),
      "value",
      {
        label: "Grass",
        view: "color",
        color: { type: "float" },
      },
    );
    color.addBinding(srgbColorTarget(uniforms.uWaterSandColor.value), "value", {
      label: "Water",
      view: "color",
      color: { type: "float" },
    });

    const normal = folder.addFolder({ title: "Normal scale" });
    normal.addBinding(uniforms.uTerrainNormalScale, "value", {
      label: "Terrain",
    });
    normal.addBinding(uniforms.uGrassNormalScale, "value", {
      label: "Grass",
    });
    normal.addBinding(uniforms.uWaterNormalScale, "value", {
      label: "Water",
    });

    const caustics = folder.addFolder({ title: "Caustics" });
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

  private createMaterial() {
    this.precision = "lowp";
    const worldUv = TSLUtils.computeMapUvByPosition(positionWorld.xz);
    const terrainNoiseUv = TSLUtils.computeAtlasUv(
      vec2(0.5),
      vec2(0, 0),
      worldUv.mul(6).fract(),
    );
    const noise = texture(assetManager.resources.noiseAtlas, terrainNoiseUv);
    const vUv = varying(worldUv);

    const terrainTypes = texture(assetManager.resources.terrainMaps, vUv);
    // LAND
    const isGrass = terrainTypes.g;
    const smoothIsGrass = smoothstep(0.05, 0.35, isGrass);
    const grassColor = uniforms.uGrassTerrainColor.mul(
      mix(0.86, 1.12, noise.b),
    );
    const terrainColor = mix(uniforms.uTerrainColor, grassColor, smoothIsGrass);

    // WATER
    const isWater = terrainTypes.b;
    const depth = positionWorld.y.negate();
    const blendFactor = smoothstep(0, 8, depth);
    const waterTint = vec3(0.35, 0.45, 0.55).mul(0.65);

    const causticsColor = computeCausticsColor(vUv, depth, isWater);

    const shallowBoost = smoothstep(0.0, 1.5, depth);
    const sandHighlight = vec3(1.0, 0.9, 0.7).mul(0.1).mul(shallowBoost);
    const waterBaseColor = mix(
      uniforms.uWaterSandColor,
      waterTint,
      blendFactor,
    ).add(sandHighlight);
    const waterColor = waterBaseColor.add(causticsColor);

    const final = mix(terrainColor, waterColor, isWater);
    const withShadow = mix(
      final.mul(lightingManager.uBakedShadowBrightness),
      final,
      terrainTypes.r,
    );
    this.colorNode = withShadow;

    // NORMAL
    const norAo = texture(assetManager.resources.terrainNormAo, vUv.mul(41.7));
    const normalScaleTerrainGrass = mix(
      uniforms.uTerrainNormalScale,
      uniforms.uGrassNormalScale,
      smoothIsGrass,
    );
    const normalScale = mix(
      normalScaleTerrainGrass,
      uniforms.uWaterNormalScale,
      isWater,
    );
    this.normalNode = normalMap(norAo.rgb, normalScale);
    this.aoNode = norAo.a;
  }
}

class OuterTerrainMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.colorNode = uniforms.uGrassTerrainColor;
  }
}

class InnerTerrain {
  constructor(material: TerrainMaterial) {
    const innerMap = this.createFloor(material);
    sceneManager.scene.add(innerMap);
  }

  private createFloor(material: TerrainMaterial) {
    // Visual
    const meshes = assetManager.resources.worldModel.scene.children.filter(
      (obj) => obj.name.startsWith("terrain-") && obj.name !== "terrain-outer",
    ) as Mesh[];

    let heightfield: Mesh | undefined;
    const innerMap = new Group();

    for (const mesh of meshes) {
      if (mesh.name === "terrain-heightfield") heightfield = mesh;
      else {
        mesh.material = material;
        mesh.geometry.computeBoundingSphere();
        mesh.geometry.computeBoundingBox();
        innerMap.add(mesh);
      }
    }

    if (!heightfield) throw new Error("No heightfield");

    // Physics
    this.createFloorPhysics(heightfield);
    return innerMap;
  }

  private getFloorDisplacementData(mesh: Mesh) {
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

    let min = 0;
    let max = 0;

    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const srcZ = N - 1 - z;
        const srcX = x;
        const srcIndex = srcZ + srcX * N;
        const dstIndex = x + z * N;
        const h = heights[srcIndex] - displacement;
        fixed[dstIndex] = h;
        if (h < min) min = h;
        if (h > max) max = h;
      }
    }

    const tex = new DataTexture(fixed, N, N, RedFormat, FloatType);
    tex.colorSpace = NoColorSpace;
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    tex.userData = { min, max };
    return tex;
  }

  private createFloorPhysics(heightfield: Mesh) {
    const displaceMentData = this.getFloorDisplacementData(heightfield);
    const { rowsCount, heights, displacement } = displaceMentData;
    const heightMap = this.createDisplacementTexture(
      rowsCount,
      heights,
      displacement,
    );
    assetManager.resources.heightmap.copy(heightMap);

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
      .setTranslation(0, -displacement, 0)
      .setFriction(1)
      .setRestitution(0.2);

    physicsManager.world.createCollider(colliderDesc).userData = {
      type: RevoColliderType.Terrain,
    };

    return displacement;
  }
}

class OuterTerrain {
  private outerFloor: Mesh;
  private kintoun: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball
  private kintounPosition = new Vector3();

  constructor() {
    this.outerFloor = this.createOuterFloorVisual();
    this.outerFloor.material = new OuterTerrainMaterial();
    this.kintoun = this.createKintoun();
    sceneManager.scene.add(this.outerFloor);

    eventsManager.on("engine-render-update", this.onEngineUpdate);
  }

  private createOuterFloorVisual() {
    const mesh = assetManager.resources.worldModel.scene.getObjectByName(
      "terrain-outer",
    ) as Mesh;
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.computeBoundingBox();
    return mesh;
  }

  private createKintoun() {
    const rigidBodyDesc = RigidBodyDesc.kinematicPositionBased().setTranslation(
      0,
      -20, // out of the physics world
      0,
    );
    const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);

    const halfSize = 2;

    const colliderDesc = ColliderDesc.cuboid(
      halfSize,
      realmConfig.HALF_FLOOR_THICKNESS,
      halfSize,
    )
      .setFriction(1)
      .setRestitution(0.2);
    physicsManager.world.createCollider(colliderDesc, rigidBody).userData = {
      type: RevoColliderType.Terrain,
    };
    return rigidBody;
  }

  private useKintoun(playerPosition: Vector3) {
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
  };
}

export default class Terrain {
  constructor() {
    const terrainMaterial = new TerrainMaterial();
    new InnerTerrain(terrainMaterial);
    new OuterTerrain();
  }
}
