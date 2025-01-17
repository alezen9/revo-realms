import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  MathUtils,
  InstancedMesh,
  Object3D,
  Texture,
  TextureLoader,
  Scene,
} from "three";
import { State } from "../core/Engine";
import { MeshPhongNodeMaterial } from "three/webgpu";
import {
  attribute,
  cos,
  faceDirection,
  float,
  fract,
  mix,
  modelNormalMatrix,
  normalize,
  positionGeometry,
  positionWorld,
  pow,
  sin,
  texture,
  transformDirection,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import perlinNoiseTextureUrl from "/perlin_noise_texture.webp?url";

type BladeGeometryData = {
  positions: Float32Array;
  uvs: Float32Array;
  indices?: Uint8Array;
};

type GrassChunk = {
  center: { x: number; z: number };
  highMesh: InstancedMesh;
  lowMesh: InstancedMesh;
  boundingRadius: number;
};

export default class Grass {
  private readonly GRASS_AREA_SIDE_SIZE = 8; // better if pow of 2 or even
  private readonly NUM_BLADES_PER_SIDE_HIGH = 96; // better if pow of 2 or perfect square
  private readonly NUM_BLADES_PER_SIDE_LOW_LOD = 16; // better if pow of 2 or perfect square
  private readonly BLADE_WIDTH = 0.025;
  private readonly BLADE_HEIGHT = 0.75;

  private readonly LOD_DIST_HIGH = 60;
  private readonly NUM_TILES_PER_CHUNK_SIDE = 2;

  private uTime = uniform(0);
  private noiseTexture: Texture;

  private chunks: GrassChunk[] = [];

  constructor(state: State) {
    const { scene } = state;

    const loader = new TextureLoader();
    this.noiseTexture = loader.load(perlinNoiseTextureUrl);

    this.buildGrassChunks(scene);
  }

  private buildGrassChunks(scene: Scene) {
    const material = this.createBladeMaterial();
    const highGeometryData = this.createGrassBladeGeometryDataHighLOD();
    const lowGeometryData = this.createGrassBladeGeometryDataLowLOD();
    const highLODGeometry = this.createGeometry("high", highGeometryData);
    const lowLODGeometry = this.createGeometry("low", lowGeometryData);

    const instancesPerSide = 2;
    const totalAreaSide = this.GRASS_AREA_SIDE_SIZE * instancesPerSide;
    const halfInstancesAreaSize = totalAreaSide / 2 + this.GRASS_AREA_SIDE_SIZE;

    for (let chunkIdxX = 0; chunkIdxX < instancesPerSide; chunkIdxX++) {
      for (let chunkIdxZ = 0; chunkIdxZ < instancesPerSide; chunkIdxZ++) {
        const chunk = this.buildSingleChunk(
          chunkIdxX,
          chunkIdxZ,
          highLODGeometry,
          lowLODGeometry,
          material,
          scene,
          halfInstancesAreaSize,
        );
        this.chunks.push(chunk);
      }
    }
  }

  private buildSingleChunk(
    chunkIndexX: number,
    chunkIndexZ: number,
    geometryHigh: BufferGeometry,
    geometryLow: BufferGeometry,
    material: MeshPhongNodeMaterial,
    scene: Scene,
    offset: number,
  ): GrassChunk {
    const tileCount = 4;

    const meshHigh = new InstancedMesh(geometryHigh, material, tileCount);
    const meshLow = new InstancedMesh(geometryLow, material, tileCount);

    // Hide medium & low initially
    meshLow.visible = false;

    // Calculate chunk's "bottom-left" corner in world coords
    const chunkWorldX =
      chunkIndexX * this.NUM_TILES_PER_CHUNK_SIDE * this.GRASS_AREA_SIDE_SIZE -
      offset;
    const chunkWorldZ =
      chunkIndexZ * this.NUM_TILES_PER_CHUNK_SIDE * this.GRASS_AREA_SIDE_SIZE -
      offset;

    // Fill tile transforms using a dummy Object3D so threejs does the math
    const dummy = new Object3D();
    let tileFlatIdx = 0;
    for (
      let tileIdxX = 0;
      tileIdxX < this.NUM_TILES_PER_CHUNK_SIDE;
      tileIdxX++
    ) {
      for (
        let tileIdxZ = 0;
        tileIdxZ < this.NUM_TILES_PER_CHUNK_SIDE;
        tileIdxZ++
      ) {
        const tileX =
          chunkWorldX +
          tileIdxX * this.GRASS_AREA_SIDE_SIZE +
          this.GRASS_AREA_SIDE_SIZE / 2;
        const tileZ =
          chunkWorldZ +
          tileIdxZ * this.GRASS_AREA_SIDE_SIZE +
          this.GRASS_AREA_SIDE_SIZE / 2;

        dummy.position.set(tileX, 0, tileZ);
        dummy.updateMatrix();

        meshHigh.setMatrixAt(tileFlatIdx, dummy.matrix);
        meshLow.setMatrixAt(tileFlatIdx, dummy.matrix);
        tileFlatIdx++;
      }
    }

    meshHigh.instanceMatrix.needsUpdate = true;
    meshLow.instanceMatrix.needsUpdate = true;

    scene.add(meshHigh, meshLow);

    // Compute chunk center
    const chunkCenterX =
      chunkWorldX +
      (this.NUM_TILES_PER_CHUNK_SIDE * this.GRASS_AREA_SIDE_SIZE) / 2;
    const chunkCenterZ =
      chunkWorldZ +
      (this.NUM_TILES_PER_CHUNK_SIDE * this.GRASS_AREA_SIDE_SIZE) / 2;

    // Approximate bounding radius
    const chunkDiagonal =
      this.NUM_TILES_PER_CHUNK_SIDE * this.GRASS_AREA_SIDE_SIZE;
    const boundingRadius = (Math.sqrt(2) * chunkDiagonal) / 2;

    return {
      center: { x: chunkCenterX, z: chunkCenterZ },
      highMesh: meshHigh,
      lowMesh: meshLow,
      boundingRadius,
    };
  }

  private vertexScaleY(vertex: number[], scale = 1) {
    const [x, y, z] = vertex;
    return [x, y * scale, z];
  }

  private vertexBendX(vertex: number[], maxAngle = 0) {
    const [x, y, z] = vertex;

    // Calculate how much to rotate based on the height (y-axis)
    const t = y / this.BLADE_HEIGHT;
    const angle = maxAngle * t; // Gradual rotation from 0 to maxAngle

    const cosTheta = Math.cos(angle);
    const sinTheta = Math.sin(angle);

    // Rotate around X-axis
    const rotatedY = y * cosTheta - z * sinTheta;
    const rotatedZ = y * sinTheta + z * cosTheta;

    return [x, rotatedY, rotatedZ];
  }

  private vertexRotateY(vertex: number[], angle: number) {
    const [x, y, z] = vertex;
    const cosTheta = Math.cos(angle);
    const sinTheta = Math.sin(angle);

    const rotatedX = x * cosTheta + z * sinTheta;
    const rotatedY = y;
    const rotatedZ = -x * sinTheta + z * cosTheta;

    return [rotatedX, rotatedY, rotatedZ];
  }

  private vertexTranslateXZ(vertex: number[], offsetX = 0, offsetZ = 0) {
    const [x, y, z] = vertex;
    const displacedX = x + offsetX;
    const displacedY = y;
    const displacedZ = z + offsetZ;
    return [displacedX, displacedY, displacedZ];
  }

  private createGrassBladeGeometryDataLowLOD(): BladeGeometryData {
    /**
     *        C
     *      /   \
     *    A ------ B
     *
     *  - Single triangle:  A-B-C
     */

    const halfWidth = this.BLADE_WIDTH / 2;
    const height = this.BLADE_HEIGHT;

    const positions = new Float32Array([
      -halfWidth,
      0,
      0, // A
      halfWidth,
      0,
      0, // B
      0,
      height,
      0, // C
    ]);

    const uvs = new Float32Array([0, 0, 1, 0, 0.5, 1]);

    return {
      positions,
      uvs,
    };
  }

  private createGrassBladeGeometryDataHighLOD(): BladeGeometryData {
    /**
     *        I
     *      /   \
     *    G ------ H
     *    |   /    |
     *    E ------ F
     *    |   /    |
     *    C ------ D
     *    |   /    |
     *    A ------ B
     *
     *  - Bottom Quad: A-B-D-C (2 triangles)
     *  - Middle Quad: C-D-F-E (2 triangles)
     *  - Top Quad:    E-F-H-G (2 triangles)
     *  - Tip:         G-H-I   (1 triangle)
     *
     *  Total: 7 triangles for smooth high-definition bending.
     */

    const halfWidth = this.BLADE_WIDTH / 2;
    const height = this.BLADE_HEIGHT;

    const segmentHeight = height / 4;

    const positions = new Float32Array([
      -halfWidth,
      0,
      0, // A
      halfWidth,
      0,
      0, // B
      -halfWidth,
      segmentHeight,
      0, // C
      halfWidth,
      segmentHeight,
      0, // D
      -halfWidth,
      segmentHeight * 2,
      0, // E
      halfWidth,
      segmentHeight * 2,
      0, // F
      -halfWidth,
      segmentHeight * 3,
      0, // G
      halfWidth,
      segmentHeight * 3,
      0, // H
      0,
      height,
      0, // I - Tip (8)
    ]);

    const indices = new Uint8Array([
      // Bottom Quad (A-B-D, A-D-C)
      0, 1, 3, 0, 3, 2,
      // Middle Quad (C-D-F, C-F-E)
      2, 3, 5, 2, 5, 4,
      // Top Quad (E-F-H, E-H-G)
      4, 5, 7, 4, 7, 6,
      // Tip (G-H-I)
      6, 7, 8,
    ]);

    const uvs = new Float32Array([
      0,
      0,
      1,
      0,
      0,
      0.25,
      1,
      0.25, // Bottom Quad
      0,
      0.5,
      1,
      0.5, // Middle Quad
      0,
      0.75,
      1,
      0.75, // Top Quad
      0.5,
      1, // Tip
    ]);

    return {
      positions,
      indices,
      uvs,
    };
  }

  private createGeometry(lod: "high" | "low", data: BladeGeometryData) {
    const {
      positions: bladePositions,
      indices: bladeIndices,
      uvs: bladeUVs,
    } = data;

    const bladeVertexCount = bladePositions.length / 3;
    const bladeIndexCount = bladeIndices?.length || 0;
    const bladesPerSide =
      lod == "high"
        ? this.NUM_BLADES_PER_SIDE_HIGH
        : this.NUM_BLADES_PER_SIDE_LOW_LOD;
    const totalBlades = Math.pow(bladesPerSide, 2);

    const tileSize = this.GRASS_AREA_SIDE_SIZE;
    const halfTileSize = tileSize / 2;
    const spacing = tileSize / bladesPerSide;

    // Buffers for the entire tile
    const positions = new Float32Array(bladeVertexCount * totalBlades * 3);
    const uvs = new Float32Array(bladeVertexCount * totalBlades * 2);
    const aoFactors = new Float32Array(bladeVertexCount * totalBlades);
    let indices = null;
    if (lod === "high") {
      indices =
        bladeVertexCount * totalBlades < 65_536 // 2^16
          ? new Uint16Array(bladeIndexCount * totalBlades)
          : new Uint32Array(bladeIndexCount * totalBlades);
    }

    let vertexOffset = 0; // position data index
    let uvOffset = 0; // UV data index
    let indexOffset = 0; // index data index

    for (let rowIdx = 0; rowIdx < bladesPerSide; rowIdx++) {
      const offsetZ =
        -halfTileSize + rowIdx * spacing + Math.random() * spacing * 0.5;
      for (let colIdx = 0; colIdx < bladesPerSide; colIdx++) {
        const offsetX =
          -halfTileSize + colIdx * spacing + Math.random() * spacing * 0.5;

        // Random rotation for variation
        const rotationAngle = MathUtils.randFloat(-1, 1);
        const bendAngle = MathUtils.randFloat(-0.5, 0.5);
        const heightScale = MathUtils.randFloat(0.5, 1.25);

        for (let i = 0; i < bladeVertexCount; i++) {
          const i3 = i * 3;
          const x = bladePositions[i3];
          const y = bladePositions[i3 + 1];
          const z = bladePositions[i3 + 2];
          const vertex = [x, y, z];
          const scaledVertex = this.vertexScaleY(vertex, heightScale);
          const bentVertex = this.vertexBendX(scaledVertex, bendAngle);
          const rotatedVertex = this.vertexRotateY(bentVertex, rotationAngle);
          const translatedVertex = this.vertexTranslateXZ(
            rotatedVertex,
            offsetX,
            offsetZ,
          );

          const v3 = vertexOffset * 3;
          positions[v3] = translatedVertex[0];
          positions[v3 + 1] = translatedVertex[1];
          positions[v3 + 2] = translatedVertex[2];

          // AO
          const heightFactor = translatedVertex[1] / this.BLADE_HEIGHT;
          const aoValue = MathUtils.smoothstep(1.0, 0.0, heightFactor);
          aoFactors[vertexOffset] = aoValue;

          vertexOffset++;
        }

        // UVs
        uvs.set(bladeUVs, uvOffset);
        uvOffset += bladeVertexCount * 2;

        // Index
        if (indices && bladeIndices) {
          const vertexIndexOffset = vertexOffset - bladeVertexCount;
          for (let i = 0; i < bladeIndexCount; i++) {
            indices[indexOffset + i] = bladeIndices[i] + vertexIndexOffset;
          }
          indexOffset += bladeIndexCount;
        }
      }
    }

    const tileGeometry = new BufferGeometry();
    tileGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    tileGeometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    tileGeometry.setAttribute("ao", new BufferAttribute(aoFactors, 1));
    if (indices) tileGeometry.setIndex(new BufferAttribute(indices, 1));

    tileGeometry.computeVertexNormals();

    return tileGeometry;
  }

  private material_curveNormals(materialNode: MeshPhongNodeMaterial) {
    // Fake cylindrical shape by curving normals
    const sideFactor = sin(uv().x.mul(Math.PI)); // Smoother curvature: -1 -> 0 -> 1
    const heightFactor = pow(uv().y, 1.5); // Softer curvature transition toward the tip

    // Stronger curvature at the base, softer at the tip
    const curvatureStrength = mix(0.6, 0.15, heightFactor);

    // Subtle Twisting for Organic Shape
    const twistStrength = mix(0.0, 0.2, heightFactor); // Slight twist near the tip
    const twistAngle = uv().y.mul(Math.PI).mul(twistStrength); // Vary twist over height

    // Apply combined curvature and twist for cylindrical illusion
    let curvedNormal = normalize(
      vec3(
        sideFactor.mul(curvatureStrength).cos().sub(twistAngle.sin().mul(0.1)), // Side curvature with slight twist
        twistAngle.sin().mul(0.05), // Subtle upward twist
        1.0,
      ),
    );

    // Transform Normals to World Space
    curvedNormal = normalize(
      transformDirection(curvedNormal, modelNormalMatrix),
    );

    // Correct for Backface Rendering
    curvedNormal = mix(
      curvedNormal,
      curvedNormal.negate(),
      float(faceDirection.lessThan(0.0)),
    );

    materialNode.normalNode = curvedNormal;
  }

  private material_addAmbientOcclusion(materialNode: MeshPhongNodeMaterial) {
    const bakedAO = attribute("ao");
    materialNode.aoNode = bakedAO;
  }

  private material_setDiffuseColor(materialNode: MeshPhongNodeMaterial) {
    const baseColor = vec3(0.1, 0.25, 0.05); // Consistent green
    const tipColor = vec3(0.4, 0.5, 0.1); // Slightly lighter tip

    // Smooth gradient from base to tip
    const heightFactor = pow(positionGeometry.y, 1.5);
    const blendedColor = mix(baseColor, tipColor, heightFactor);

    materialNode.colorNode = blendedColor;
  }

  private material_addWindMotion(materialNode: MeshPhongNodeMaterial) {
    // 1. **Blade-Level Noise Sampling (With Seamless Wrapping)**
    const bladeOrigin = vec2(positionWorld.x, positionWorld.z);
    const bladeNoiseScale = 0.05;
    const detailNoiseScale = 0.2; // Fine turbulence
    const timeFactor = this.uTime.mul(0.1); // Smooth time evolution

    // **Use fract to ensure UVs stay in [0, 1] for seamless looping**
    const bladeUV = fract(bladeOrigin.mul(bladeNoiseScale).add(timeFactor));
    const detailUV = fract(
      bladeOrigin.mul(detailNoiseScale).add(timeFactor.mul(1.5)),
    );

    // 2. **Sample Noise with Seamless Wrapping**
    const bladeWindSample = texture(this.noiseTexture, bladeUV).r;
    const detailSample = texture(this.noiseTexture, detailUV).r;

    // 3. **Blend Large and Small Scale Noise**
    const blendedWind = mix(bladeWindSample, detailSample, 0.3);

    // 4. **Smooth Wind Direction**
    const windAngle = blendedWind.mul(Math.PI * 2.0);
    const windDirection = normalize(vec2(cos(windAngle), sin(windAngle)));

    // 5. **Height-Based Bending for Natural Sway**
    const heightFactor = pow(positionGeometry.y.div(this.BLADE_HEIGHT), 2.0);
    const bendStrength = blendedWind.mul(0.3).mul(heightFactor);

    // 6. **Apply Consistent Bending to the Entire Blade**
    const bendOffset = vec3(windDirection.x, 0.0, windDirection.y).mul(
      bendStrength,
    );
    const bentPosition = positionWorld.add(bendOffset);

    // 7. **Apply Final Bent Position**
    materialNode.positionNode = bentPosition;
  }

  private createBladeMaterial() {
    const materialNode = new MeshPhongNodeMaterial();
    materialNode.side = DoubleSide;

    this.material_curveNormals(materialNode);
    // materialNode.colorNode = normalLocal.add(1.0).div(2.0);
    this.material_addAmbientOcclusion(materialNode);
    this.material_setDiffuseColor(materialNode);
    this.material_addWindMotion(materialNode);
    return materialNode;
  }

  // ########################################
  //            Per-Frame logic
  // ########################################

  public update(state: State) {
    const { clock, camera } = state;
    this.updateChunkLOD(camera);
    this.uTime.value = clock.getElapsedTime();
  }

  private updateChunkLOD(camera: State["camera"]) {
    const cameraPos = camera.position;

    for (const chunk of this.chunks) {
      // 3D distance from chunk center
      const dx = cameraPos.x - chunk.center.x;
      const dy = cameraPos.y; // floor is y=0
      const dz = cameraPos.z - chunk.center.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Hard cutoff-based LOD logic
      if (distance < this.LOD_DIST_HIGH) {
        chunk.highMesh.visible = true;
        chunk.lowMesh.visible = false;
      } else {
        chunk.highMesh.visible = false;
        chunk.lowMesh.visible = true;
      }
    }
  }
}
