import {
  float,
  Fn,
  fract,
  mix,
  positionWorld,
  pow,
  smoothstep,
  texture,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { UniformType } from "../types";
import { Color, Mesh, MeshLambertNodeMaterial, Vector3 } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import { realmConfig } from "../realms/PortfolioRealm";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
} from "@dimforge/rapier3d";
import { physics } from "../systems/Physics";
import { State } from "../Game";
import { sceneManager } from "../systems/SceneManager";
import { debugManager } from "../systems/DebugManager";
import { eventsManager } from "../systems/EventsManager";
import { tslUtils } from "../systems/TSLUtils";

type TerrainUniforms = {
  uTime?: UniformType<number>;
  uGrassTerrainColor?: UniformType<Color>;
  uWaterSandColor?: UniformType<Color>;
  uPathSandColor?: UniformType<Color>;
};

const defaultUniforms: TerrainUniforms = {
  uTime: uniform(0),
  uGrassTerrainColor: uniform(new Color()),
  uWaterSandColor: uniform(new Color()),
  uPathSandColor: uniform(new Color()),
};

class TerainMaterial extends MeshLambertNodeMaterial {
  private _uniforms: TerrainUniforms;
  constructor(uniforms: TerrainUniforms) {
    super();

    this._uniforms = { ...defaultUniforms, ...uniforms };
    this.createMaterial();
  }

  private computeCausticsDiffuse = Fn(
    ([
      vUv = vec2(0, 0),
      vDepth = float(0),
      causticsShadowColor = vec3(0, 0, 0),
    ]) => {
      const timer = this._uniforms.uTime.mul(0.1);
      const scaleFactor = float(20);
      const scaledUv = vUv.mul(scaleFactor);
      const scaledCausticsUvA = fract(scaledUv.add(vec2(timer, 0)));
      const scaledCausticsUvB = fract(scaledUv.add(vec2(0, timer.negate())));
      const noiseA = texture(assetManager.noiseTexture, scaledCausticsUvA, 1).g;
      const noiseB = texture(assetManager.noiseTexture, scaledCausticsUvB, 2).g;
      const caustics = noiseA.add(noiseB);
      const depthFalloff = smoothstep(-1, 10, vDepth);
      const adjustedCaustics = pow(caustics, 3).mul(float(1).sub(depthFalloff));

      const causticsHighlightColor = vec3(0.6, 0.8, 1.0).mul(0.3);

      const causticsColor = mix(
        causticsShadowColor,
        causticsHighlightColor,
        adjustedCaustics,
      );

      return causticsColor;
    },
  );

  private computeWaterDiffuse = Fn(([vDepth = float(0), vUv = vec2(0, 0)]) => {
    const depth1 = float(8.0); // Transition depth
    const epsilon = float(0.001); // Prevents precision issues

    const blendFactor = smoothstep(0.0, depth1.add(epsilon), vDepth); // How much tint is applied

    const sandColor = this._uniforms.uWaterSandColor; // Sand color

    // const waterTint = vec3(0.4, 0.5, 0.45); // use in when plenty of vegetation and/or algae in lake
    const waterTint = vec3(0.35, 0.45, 0.55).mul(0.65); // bit desaturated blue

    const causticsColor = this.computeCausticsDiffuse(vUv, vDepth);

    const shallowBoost = smoothstep(0.0, 1.5, vDepth);
    const sandHighlight = vec3(1.0, 0.9, 0.7).mul(0.1).mul(shallowBoost);
    const waterBaseColor = mix(sandColor, waterTint, blendFactor).add(
      sandHighlight,
    );

    return waterBaseColor.add(causticsColor);
  });

  private createMaterial() {
    this.flatShading = false;
    const _uv = tslUtils.computeMapUvByPosition(positionWorld.xz);
    const vUv = varying(_uv);

    const shadowAo = texture(assetManager.terrainShadowAo, uv().clamp());
    this.aoNode = shadowAo.g;

    const factors = texture(assetManager.terrainTypeMap, vUv, 2.5);
    const grassFactor = factors.g;
    const waterFactor = factors.b;
    const sandFactor = float(1).sub(grassFactor);
    const pathFactor = sandFactor.sub(waterFactor);

    // Fake Normal
    const sandNormal = texture(assetManager.sandNormal, fract(vUv.mul(30)));

    const grassUv = fract(vUv.mul(30));
    const grassNormal = texture(assetManager.grassNormal, grassUv);
    const terrainNoise = grassNormal.dot(sandNormal).mul(0.65);

    // Diffuse
    // Grass
    const grassColorSample = texture(assetManager.grassDiffuse, grassUv);
    const sandAlpha = float(1).sub(grassColorSample.a);
    const grassColor = this._uniforms.uGrassTerrainColor
      .mul(sandAlpha)
      .add(grassColorSample)
      .mul(grassFactor)
      .mul(0.85);

    const pathColor = this._uniforms.uPathSandColor.mul(1.2).mul(pathFactor);

    // Water
    const vDepth = varying(positionWorld.y.negate());
    const waterBaseColor = this.computeWaterDiffuse(vDepth, vUv);
    const waterColor = waterBaseColor.mul(waterFactor);

    // Final diffuse
    const finalColor = grassColor
      .add(pathColor.mul(terrainNoise))
      .add(waterColor.mul(terrainNoise).mul(0.5));

    this.colorNode = finalColor.mul(shadowAo.r);
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
    const floor = assetManager.realmModel.scene.getObjectByName(
      "floor",
    ) as Mesh;
    floor.receiveShadow = true;

    // Physics
    this.createFloorPhysics();
    return floor;
  }

  private getFloorDisplacementData() {
    const mesh = assetManager.realmModel.scene.getObjectByName(
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

  private createFloorPhysics() {
    const displaceMentData = this.getFloorDisplacementData();
    const { rowsCount, heights, displacement } = displaceMentData;

    const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(
      0,
      -displacement,
      0,
    );
    const rigidBody = physics.world.createRigidBody(rigidBodyDesc);

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

    physics.world.createCollider(colliderDesc, rigidBody);
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
  }

  private createOuterFloorVisual() {
    const outerFloor = assetManager.realmModel.scene.getObjectByName(
      "outer_world",
    ) as Mesh;
    outerFloor.receiveShadow = true;
    return outerFloor;
  }

  private createKintoun() {
    const rigidBodyDesc = RigidBodyDesc.kinematicPositionBased().setTranslation(
      0,
      -20, // out of the physics world
      0,
    );
    const rigidBody = physics.world.createRigidBody(rigidBodyDesc);

    const halfSize = 2;

    const colliderDesc = ColliderDesc.cuboid(
      halfSize,
      realmConfig.HALF_FLOOR_THICKNESS,
      halfSize,
    )
      .setFriction(1)
      .setRestitution(0.2);
    physics.world.createCollider(colliderDesc, rigidBody);
    return rigidBody;
  }

  private useKintoun(playerPosition: Vector3) {
    this.kintounPosition
      .copy(playerPosition)
      .setY(-realmConfig.HALF_FLOOR_THICKNESS);
    this.kintoun.setTranslation(this.kintounPosition, true);
  }

  update(state: State) {
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
  private outerTerrain: OuterTerrain;

  private uniforms: TerrainUniforms = {
    uTime: uniform(0),
    uGrassTerrainColor: uniform(new Color().setRGB(0.21, 0.26, 0.05)),
    uWaterSandColor: uniform(new Color().setRGB(0.54, 0.39, 0.2)),
    uPathSandColor: uniform(new Color().setRGB(0.65, 0.49, 0.27)),
  };

  constructor() {
    const terrainMaterial = new TerainMaterial(this.uniforms);
    new InnerTerrain(terrainMaterial);
    this.outerTerrain = new OuterTerrain(terrainMaterial);
    eventsManager.on("update", this.update.bind(this));

    this.debugTerrain();
  }

  private debugTerrain() {
    const terrainFolder = debugManager.panel.addFolder({ title: "⛰️ Terrain" });
    terrainFolder.expanded = false;
    terrainFolder.addBinding(this.uniforms.uPathSandColor, "value", {
      label: "Path color",
      view: "color",
      color: { type: "float" },
    });
    terrainFolder.addBinding(this.uniforms.uWaterSandColor, "value", {
      label: "Water bed color",
      view: "color",
      color: { type: "float" },
    });
    terrainFolder.addBinding(this.uniforms.uGrassTerrainColor, "value", {
      label: "Grass terrain color",
      view: "color",
      color: { type: "float" },
    });
  }

  private update(state: State) {
    const { clock } = state;
    this.uniforms.uTime.value = clock.getElapsedTime();
    this.outerTerrain.update(state);
  }
}
