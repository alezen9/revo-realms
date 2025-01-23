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
import { MeshLambertNodeMaterial, PlaneGeometry } from "three/webgpu";
import floor_TEMPORARY_TextureUrl from "/environment/heightmap-1024.webp?url";
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
    const { world, scene } = state;

    this.loadFloorTexture(state); // temporary
    this.loadDisplacementModel(state);

    this.floor = this.createFloorFromModel();
    scene.add(this.floor);

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

  private createFloorFromModel() {
    const geometry = new PlaneGeometry(150, 100, 512, 512);
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
      const index = indexZ + indexX * rowsCount;

      heights[index] = y;
    }
    this.uDisplacement.value = displacement;

    const { upsampledHeights, upsampledCount } = this.upSampleDisplacement(
      heights,
      rowsCount,
      8,
    );

    return {
      rowsCount: upsampledCount,
      heights: upsampledHeights,
      displacement,
    };
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

  // Helper for piecewise linear segment: from altA..altB => colorA..colorB
  // ratio = clamp( (alt - altA)/(altB - altA), 0..1 )
  private segmentColor = Fn(
    ([
      altIn = float(0),
      altA = float(0),
      altB = float(0),
      colA = color("black"),
      colB = color("black"),
    ]) => {
      const ratio = altIn.sub(altA).div(altB.sub(altA));
      const clampedRatio = clamp(ratio, 0.0, 1.0);
      return mix(colA, colB, clampedRatio);
    },
  );

  private applyAltitudeColor = Fn(([alt = float(0)]) => {
    // Define altitude thresholds
    // alt < -1.5 => deep ocean
    // alt in [-1.5..-0.5] => gradient ocean
    // alt in [-0.5..-0.1] => gradient to sand
    // alt in [-0.1.. 0.3] => gradient to grass
    // alt > 0.3 => solid grass

    // THRESHOLDS
    const alt1 = float(-1.5);
    const alt2 = float(-0.5);
    const alt3 = float(-0.1);
    const alt4 = float(0.3);

    // COLORS for each range boundary
    const c0 = color("#000080"); // deep ocean
    const c1 = color("#ADD8E6"); // lightblue
    const c2 = color("#c2b280"); // sand
    const c3 = color("#228B22"); // grass

    // We'll combine 4 segments:
    // 1) alt < alt1 => c0
    // 2) alt in [alt1..alt2] => c0->c1
    // 3) alt in [alt2..alt3] => c1->c2
    // 4) alt in [alt3..alt4] => c2->c3
    // 5) alt > alt4 => c3

    // Step approach: we do it cumulatively
    // color1 = segment from alt1..alt2
    const color1 = this.segmentColor(alt, alt1, alt2, c0, c1);
    // color2 = segment from alt2..alt3
    const color2 = this.segmentColor(alt, alt2, alt3, c1, c2);
    // color3 = segment from alt3..alt4
    const color3 = this.segmentColor(alt, alt3, alt4, c2, c3);

    // Adjust if needed based on TSL's step signature.
    // TSL doc: step(edge, x) => 0 if x<edge else 1.
    // If we want "alt<alt1 => 0 else 1," we do step(alt1, alt).

    const s1c = step(alt1, alt);
    const s2c = step(alt2, alt);
    const s3c = step(alt3, alt);
    const s4c = step(alt4, alt);

    // Logic:
    // if alt < alt1 => color = c0
    // else if alt<alt2 => color = color1
    // else if alt<alt3 => color = color2
    // else if alt<alt4 => color = color3
    // else => c3

    // Implementation with layered mix:
    // pick12 = mix(c0, color1, s1c) => if alt<alt1 => c0 else color1
    // pick123 = mix(pick12, color2, s2c) => if alt<alt2 => pick12 else color2
    // pick1234 = mix(pick123, color3, s3c)
    // final = mix(pick1234, c3, s4c)

    const pick12 = mix(c0, color1, s1c);
    const pick123 = mix(pick12, color2, s2c);
    const pick1234 = mix(pick123, color3, s3c);
    const finalColor = mix(pick1234, c3, s4c);

    return finalColor;
  });

  private bilinearSampleHeight = Fn(([uv = vec2(0, 0)]) => {
    const texW = float(this.displacementTexture.image.width);
    const texH = float(this.displacementTexture.image.height);

    // st in [0..64] range
    const st = uv.mul(vec2(texW, texH)).sub(vec2(0.5));

    const iST = st.floor();
    const fST = st.fract();

    // define corners
    const corner00UV = iST.add(vec2(0, 0).add(0.5)).div(vec2(texW, texH));
    const corner10UV = iST.add(vec2(1, 0).add(0.5)).div(vec2(texW, texH));
    const corner01UV = iST.add(vec2(0, 1).add(0.5)).div(vec2(texW, texH));
    const corner11UV = iST.add(vec2(1, 1).add(0.5)).div(vec2(texW, texH));

    // sample
    const h00 = texture(this.displacementTexture, corner00UV).r;
    const h10 = texture(this.displacementTexture, corner10UV).r;
    const h01 = texture(this.displacementTexture, corner01UV).r;
    const h11 = texture(this.displacementTexture, corner11UV).r;

    // mix in x
    const h0 = h00.mix(h10, fST.x);
    const h1 = h01.mix(h11, fST.x);

    // final in y
    return h0.mix(h1, fST.y);
  });

  private material_applyMapDisplacement = Fn(([uv = vec2(0, 0)]) => {
    const displacedY = texture(this.displacementTexture, uv).r;
    // const displacedY = this.bilinearSampleHeight(uv);

    const displacedPosition = vec3(
      positionLocal.x,
      displacedY.sub(this.uDisplacement),
      positionLocal.z,
    );

    return displacedPosition;
  });

  private material_applyMapTexture = Fn(([uv = vec2(0, 0)]) => {
    const displacedY = texture(this.displacementTexture, uv).r;
    // const displacedY = this.bilinearSampleHeight(uv);

    const edgeX = step(-this.HALF_MAP_SIZE, positionWorld.x).mul(
      step(positionWorld.x, this.HALF_MAP_SIZE),
    );
    const edgeZ = step(-this.HALF_MAP_SIZE, positionWorld.z).mul(
      step(positionWorld.z, this.HALF_MAP_SIZE),
    );
    const isOutsideMap = float(1.0).sub(edgeX.mul(edgeZ)); // Returns 1.0 if outside, 0.0 if inside

    const outsideMapColor = color("#8FBC8B");

    const altitudeColor = this.applyAltitudeColor(
      displacedY.sub(this.uDisplacement),
    );

    return mix(altitudeColor, outsideMapColor, isOutsideMap);
  });

  private createFloorMaterial() {
    const materialNode = new MeshLambertNodeMaterial();

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
