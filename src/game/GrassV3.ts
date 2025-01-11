import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  MathUtils,
  InstancedMesh,
} from "three";
import { State } from "../core/Engine";
import {
  Color,
  Mesh,
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  MeshPhongMaterial,
  MeshPhongNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  Object3D,
  RepeatWrapping,
  Texture,
  TextureLoader,
  UniformNode,
  Vector3,
} from "three/webgpu";
import {
  abs,
  cos,
  dot,
  float,
  fract,
  max,
  mix,
  mod,
  normalGeometry,
  normalize,
  positionGeometry,
  positionWorld,
  pow,
  remap,
  rotate,
  sin,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import perlinNoiseTextureUrl from "/perlin_noise_texture.png?url";

export default class GrassV3 {
  private readonly GRASS_AREA_SIDE_SIZE = 8; // better if pow of 2 or even
  private readonly NUM_BLADES_PER_SIDE = 49; // better if pow of 2 or perfect square
  private readonly NUM_VERTICES_PER_BLADE_HIGH = 15;
  //   private readonly NUM_VERTICES_PER_BLADE_MID = 9;
  //   private readonly NUM_VERTICES_PER_BLADE_LOW = 3;
  private readonly BLADE_WIDTH = 0.05;
  private readonly BLADE_HEIGHT = 1;
  private uTime = uniform(0);
  private noiseTexture: Texture;

  constructor(state: State) {
    const { scene } = state;

    const loader = new TextureLoader();
    this.noiseTexture = loader.load(perlinNoiseTextureUrl);
    this.noiseTexture.wrapS = RepeatWrapping;
    this.noiseTexture.wrapT = RepeatWrapping;

    const geometry = this.createGeometry();
    const material = this.createBladeMaterial();
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);

    // const instances = this.createInstances();
    // scene.add(instances);
  }

  private createInstances() {
    const geometry = this.createGeometry();
    const material = this.createBladeMaterial();

    const instancesPerSide = 10;
    const totalInstances = instancesPerSide * instancesPerSide;
    const instances = new InstancedMesh(geometry, material, totalInstances);

    const totalAreaSide = this.GRASS_AREA_SIDE_SIZE * instancesPerSide;
    const halfInstancesAreaSize = totalAreaSide / 2;

    const cellSize = this.GRASS_AREA_SIDE_SIZE / this.NUM_BLADES_PER_SIDE;
    const halfCellSize = cellSize / 2;
    const halfAreaSize = this.GRASS_AREA_SIDE_SIZE / 2;

    const dummy = new Object3D();
    let tileIdx = 0;
    for (let rowIdx = 0; rowIdx < instancesPerSide; rowIdx++) {
      const displacedZ =
        rowIdx * this.GRASS_AREA_SIDE_SIZE +
        halfAreaSize -
        halfInstancesAreaSize -
        halfCellSize;
      for (let colIdx = 0; colIdx < instancesPerSide; colIdx++) {
        const displacedX =
          colIdx * this.GRASS_AREA_SIDE_SIZE +
          halfAreaSize -
          halfInstancesAreaSize -
          halfCellSize;

        dummy.position.set(displacedX, 0, displacedZ);

        dummy.updateMatrix();

        instances.setMatrixAt(tileIdx, dummy.matrix);
        tileIdx++;
      }
    }

    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();

    return instances;
  }

  private applyBendingX(vertex: number[], maxAngle = 0) {
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

  private applyRotationY(vertex: number[], angle: number) {
    const [x, y, z] = vertex;
    const cosTheta = Math.cos(angle);
    const sinTheta = Math.sin(angle);

    const rotatedX = x * cosTheta + z * sinTheta;
    const rotatedY = y;
    const rotatedZ = -x * sinTheta + z * cosTheta;

    return [rotatedX, rotatedY, rotatedZ];
  }

  private applyDisplacementXZ(
    vertex: number[],
    displacementX = 0,
    displacementZ = 0,
  ) {
    const [x, y, z] = vertex;
    const displacedX = x + displacementX;
    const displacedY = y;
    const displacedZ = z + displacementZ;
    return [displacedX, displacedY, displacedZ];
  }

  private computeSingleBladeUvsMid() {
    // Static UV mapping for one blade
    // ORDER MATTERS - Same order as when creating the Vertices
    const uvs = new Float32Array([
      0.0,
      0.0, // A (left bottom)
      1.0,
      0.0, // B (right bottom)
      1.0,
      0.5, // C (right middle)
      1.0,
      0.5, // C (right middle, repeated)
      0.0,
      0.5, // E (left middle)
      0.0,
      0.0, // A (left bottom, repeated)
      0.0,
      0.5, // E (left middle, repeated)
      1.0,
      0.5, // C (right middle, repeated)
      0.5,
      1.0, // D (top)
    ]);

    return uvs;
  }

  private computeSingleBladeUvsHigh() {
    // Static UV mapping for one blade
    // ORDER MATTERS - Same order as when creating the Vertices
    const a = [0, 0];
    const b = [1, 0];
    const c = [1, 0.33];
    const d = [1, 0.66];
    const e = [0.5, 1];
    const f = [0, 0.66];
    const g = [0, 0.33];
    const uvs = new Float32Array([
      ...a,
      ...b,
      ...c, // Triangle 1
      ...a,
      ...c,
      ...g, // Triangle 2
      ...g,
      ...c,
      ...d, // Triangle 3
      ...g,
      ...d,
      ...f, // Triangle 4
      ...f,
      ...d,
      ...e, // Triangle 5
    ]);

    return uvs;
  }

  private createBladeVerticesMid(
    displacementX = 0,
    displacementZ = 0,
    rotationAngle = 0,
    bendAngle = 0,
  ) {
    //          D
    //        *   *
    //      *       *
    //   *            *
    //  E   *   *   *    C
    //  *           *    *
    //  *       *        *
    //  *   *            *
    //  A  * (0,0,0) *   B

    const halfWidth = this.BLADE_WIDTH / 2;
    const height = this.BLADE_HEIGHT;
    const halfHeight = height / 2;

    const vertices = [
      [-halfWidth, 0.0, 0.0], // a
      [halfWidth, 0.0, 0.0], // b
      [halfWidth, halfHeight, 0.0], // c
      [0.0, height, 0.0], // d
      [-halfWidth, halfHeight, 0.0], // e
    ];

    for (let i = 0; i < vertices.length; i++) {
      let v = vertices[i];
      v = this.applyBendingX(v, bendAngle);
      v = this.applyRotationY(v, rotationAngle);
      v = this.applyDisplacementXZ(v, displacementX, displacementZ);
      vertices[i] = v;
    }

    const [a, b, c, d, e] = vertices;

    return [...a, ...b, ...c, ...c, ...e, ...a, ...e, ...c, ...d];
  }

  private createBladeVerticesHigh(
    displacementX = 0,
    displacementZ = 0,
    rotationAngle = 0,
    bendAngle = 0,
  ) {
    //          E
    //        *   *
    //      *       *
    //   *            *
    //  F   *   *   *    D
    //  *           *    *
    //  *       *        *
    //  *   *            *
    //  G   *   *   *    C
    //  *           *    *
    //  *       *        *
    //  *   *            *
    //  A  * (0,0,0) *   B

    // Triangle 1 ABC
    // Triangle 2 ACG
    // Triangle 3 GCD
    // Triangle 4 GDF
    // Triangle 5 FDE

    const halfWidth = this.BLADE_WIDTH / 2;
    const height = this.BLADE_HEIGHT;
    const oneThirdHeight = height / 3;
    const twoThirdHeight = oneThirdHeight * 2;

    const vertices = [
      [-halfWidth, 0, 0], // A
      [halfWidth, 0, 0], // B
      [halfWidth, oneThirdHeight, 0], // C
      [halfWidth, twoThirdHeight, 0], // D
      [0, height, 0], // E
      [-halfWidth, twoThirdHeight, 0], // F
      [-halfWidth, oneThirdHeight, 0], // G
    ];

    for (let i = 0; i < vertices.length; i++) {
      let v = vertices[i];
      v = this.applyBendingX(v, bendAngle);
      v = this.applyRotationY(v, rotationAngle);
      v = this.applyDisplacementXZ(v, displacementX, displacementZ);
      vertices[i] = v;
    }

    const [a, b, c, d, e, f, g] = vertices;

    return [
      ...a,
      ...b,
      ...c, // Triangle 1
      ...a,
      ...c,
      ...g, // Triangle 2
      ...g,
      ...c,
      ...d, // Triangle 3
      ...g,
      ...d,
      ...f, // Triangle 4
      ...f,
      ...d,
      ...e, // Triangle 5
    ];
  }

  private material_curveNormals(materialNode: MeshBasicNodeMaterial) {
    // Control the roundness, stronger curve at the base
    const curvatureAngle = Math.PI * 0.5;
    const heightFactor = float(1).sub(positionGeometry.y);
    const curvedAngle = mix(-curvatureAngle, curvatureAngle, uv().x).mul(
      heightFactor,
    );
    // Create a Y-axis rotation based on the curved angle
    const curvedRotation = vec3(0, curvedAngle, 0);
    // Apply the smooth rotation to the normals
    const roundedNormal = rotate(normalGeometry, curvedRotation);
    materialNode.normalNode = roundedNormal;
  }

  private material_setDiffuseColor0(materialNode: MeshBasicNodeMaterial) {
    const baseColor = vec3(0.05, 0.2, 0.01);
    const tipColor = vec3(0.5, 0.5, 0.1);
    const diffuseColor = mix(baseColor, tipColor, positionGeometry.y);
    materialNode.colorNode = diffuseColor;
  }

  private material_setDiffuseColor(materialNode: MeshBasicNodeMaterial) {
    // 1. Base and Tip Colors (richer tones)
    const baseColor = vec3(0.1, 0.3, 0.05); // Deeper green at the base
    const tipColor = vec3(0.4, 0.6, 0.1); // Lighter green at the tip

    // 2. Noise-based color variation for natural randomness
    const colorNoiseScale = 0.3;
    const colorNoiseUV = positionWorld.xz.mul(colorNoiseScale);
    const colorNoiseSample = texture(this.noiseTexture, colorNoiseUV).r;

    // Mix base and tip colors with subtle noise variation
    const heightFactor = pow(positionGeometry.y, 1.2); // More contrast near the tip
    const noiseFactor = mix(-0.05, 0.05, colorNoiseSample); // Subtle color noise
    const blendedColor = mix(
      baseColor,
      tipColor,
      heightFactor.add(noiseFactor),
    );

    // 3. Ambient color tinting based on blade orientation (fake global lighting)
    const lightDirection = normalize(vec3(0.5, 1.0, 0.5)); // Sunlight direction
    const facingLightFactor = dot(normalGeometry, lightDirection).max(0.0);
    const ambientTint = vec3(0.1, 0.15, 0.05); // Soft environmental light tint

    const finalColor = mix(
      blendedColor,
      ambientTint,
      float(1.0).sub(facingLightFactor),
    );

    // 4. Apply the enhanced diffuse color
    materialNode.colorNode = finalColor;
  }

  private material_addAmbientOcclusion(materialNode: MeshBasicNodeMaterial) {
    // Base ao gradient along the blade height, darker at the base
    const aoHeight = smoothstep(0.0, 0.3, positionGeometry.y);
    // Slight ao variation
    const aoVariation = mix(0.8, 1.0, uv().x);
    // Denser shadows near the ground for thicker grass areas
    const aoDensity = smoothstep(0.0, 0.15, positionGeometry.y);
    // Self-shadowing effect for bent blades, stronger shadow on inner curves
    const bendShadow = float(1).sub(abs(normalGeometry.x));
    // Combine all ao components for a realistic effect
    materialNode.aoNode = aoHeight.mul(aoVariation, aoDensity, bendShadow);
  }

  private material_addWindMotion(materialNode: MeshBasicNodeMaterial) {
    // 1. Define wind direction and base speed
    const globalWindDirection = normalize(vec2(1.0, 0.2)); // Diagonal wind
    const baseWindSpeed = 0.05; // Softer, steady wind

    // 2. Multi-scale noise for dynamic wind behavior
    const largeNoiseScale = 0.1;
    const mediumNoiseScale = 0.25;
    const smallNoiseScale = 0.6;

    // 3. Blade-Specific Offset to desynchronize movement
    const bladeHash = fract(
      sin(dot(positionWorld.xz, vec2(12.9898, 78.233))).mul(43758.5453),
    );
    const bladeOffset = vec2(bladeHash, bladeHash).mul(0.2); // Small positional offset

    // 4. Noise Warping - Distort noise sampling
    const warpScale = 0.1;
    const warpUV = positionWorld.xz.mul(warpScale).add(this.uTime.mul(0.03)); // Slow-moving noise warp
    const warpOffset = texture(this.noiseTexture, warpUV.add(bladeOffset))
      .rg.mul(0.15)
      .sub(0.075);

    // Apply warping to each noise scale
    const warpedLargeScaleUV = positionWorld.xz
      .mul(largeNoiseScale)
      .add(globalWindDirection.mul(this.uTime.mul(baseWindSpeed)))
      .add(warpOffset);
    const warpedMediumScaleUV = positionWorld.xz
      .mul(mediumNoiseScale)
      .add(globalWindDirection.mul(this.uTime.mul(baseWindSpeed * 2.0)))
      .add(warpOffset);
    const warpedSmallScaleUV = positionWorld.xz
      .mul(smallNoiseScale)
      .add(globalWindDirection.mul(this.uTime.mul(baseWindSpeed * 4.0)))
      .add(warpOffset);

    // 5. Sample warped noise for wind strength
    const largeScaleWind = texture(this.noiseTexture, warpedLargeScaleUV).r;
    const mediumScaleWind = texture(this.noiseTexture, warpedMediumScaleUV).r;
    const smallScaleWind = texture(this.noiseTexture, warpedSmallScaleUV).r;

    // 6. Combine noise layers for dynamic wind
    const combinedWindStrength = mix(
      mix(largeScaleWind, mediumScaleWind, 0.6),
      smallScaleWind,
      0.2,
    );

    // 7. Localized Gusts (Bubble Wind)
    const bubbleNoiseScale = 0.05;
    const bubbleUV = positionWorld.xz
      .mul(bubbleNoiseScale)
      .add(this.uTime.mul(0.1));
    const bubbleGust = texture(this.noiseTexture, bubbleUV.add(bladeOffset)).r;

    // Amplify wind strength with localized gusts
    const localizedWindStrength = combinedWindStrength.mul(
      mix(0.8, 2.0, bubbleGust),
    );

    // 8. Per-Blade Directional Variation
    const angleVariation = mix(-0.2, 0.2, bladeHash);
    const variedWindDirection = normalize(
      globalWindDirection.add(vec2(angleVariation, angleVariation)),
    );

    // 9. Smooth Height-Based Bending
    const maxBendAngle = Math.PI * 0.2; // Stronger bending (~36°)
    const swayFactor = pow(positionWorld.y.div(this.BLADE_HEIGHT), 1.5);
    const adaptiveBendAngle = localizedWindStrength
      .mul(swayFactor)
      .mul(maxBendAngle);

    // 10. Multi-Axis Bending for Organic Flow
    const secondaryWindDir = normalize(
      vec2(globalWindDirection.y.mul(-1), globalWindDirection.x),
    );
    const combinedBendDirection = normalize(
      variedWindDirection.add(secondaryWindDir.mul(0.3)),
    );

    // 11. Apply Pivot-Based Smooth Bending
    const rotateAxisNode = normalize(
      vec3(combinedBendDirection.x, 0.0, combinedBendDirection.y),
    );
    const pivotPoint = vec3(positionWorld.x, 0.0, positionWorld.z);
    const vertexOffset = positionWorld.sub(pivotPoint);

    // Strong, Smooth Bending Without Patterns
    const bentVertexOffset = rotate(
      vertexOffset,
      rotateAxisNode.mul(adaptiveBendAngle),
    );
    const bentPosition = pivotPoint.add(bentVertexOffset);

    // 12. Apply the final bent position
    materialNode.positionNode = bentPosition;
  }

  private createBladeMaterial() {
    const materialNode = new MeshBasicNodeMaterial();
    materialNode.side = DoubleSide;
    this.material_curveNormals(materialNode);
    this.material_setDiffuseColor(materialNode);
    this.material_addAmbientOcclusion(materialNode);
    this.material_addWindMotion(materialNode);
    return materialNode;
  }

  public update(state: State) {
    const { clock } = state;
    this.uTime.value = clock.getElapsedTime();
  }

  // ########################################
  //            Refactoring
  // ########################################

  private createGrassBladeGeometryData() {
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

    const indices = new Uint16Array([
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

  private createGeometry() {
    const {
      positions: bladePositions,
      indices: bladeIndices,
      uvs: bladeUVs,
    } = this.createGrassBladeGeometryData();

    const bladeVertexCount = bladePositions.length / 3;
    const bladeIndexCount = bladeIndices.length;
    const bladesPerSide = this.NUM_BLADES_PER_SIDE;
    const totalBlades = Math.pow(bladesPerSide, 2);

    const tileSize = this.GRASS_AREA_SIDE_SIZE;
    const halfTileSize = tileSize / 2;
    const spacing = tileSize / bladesPerSide;

    // Buffers for the entire tile
    const positions = new Float32Array(bladeVertexCount * totalBlades * 3);
    const uvs = new Float32Array(bladeVertexCount * totalBlades * 2);
    const indices =
      bladeVertexCount * totalBlades < 65_536 // 2^16
        ? new Uint16Array(bladeIndexCount * totalBlades)
        : new Uint32Array(bladeIndexCount * totalBlades);
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
        const rotationAngle = Math.random() * Math.PI * 2;
        const cosTheta = Math.cos(rotationAngle);
        const sinTheta = Math.sin(rotationAngle);

        for (let i = 0; i < bladeVertexCount; i++) {
          const x = bladePositions[i * 3];
          const y = bladePositions[i * 3 + 1];
          const z = bladePositions[i * 3 + 2];

          // Rotate on Y and offset each blade
          positions[vertexOffset * 3] = x * cosTheta - z * sinTheta + offsetX;
          positions[vertexOffset * 3 + 1] = y;
          positions[vertexOffset * 3 + 2] =
            x * sinTheta + z * cosTheta + offsetZ;

          vertexOffset++;
        }

        // UVs
        uvs.set(bladeUVs, uvOffset);
        uvOffset += bladeVertexCount * 2;

        // Index
        const vertexIndexOffset = vertexOffset - bladeVertexCount;
        for (let i = 0; i < bladeIndexCount; i++) {
          indices[indexOffset + i] = bladeIndices[i] + vertexIndexOffset;
        }
        indexOffset += bladeIndexCount;
      }
    }

    const tileGeometry = new BufferGeometry();
    tileGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    tileGeometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    tileGeometry.setIndex(new BufferAttribute(indices, 1));

    tileGeometry.computeVertexNormals();

    return tileGeometry;
  }
}
