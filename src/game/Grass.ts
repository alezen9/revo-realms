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
  MeshPhongNodeMaterial,
  MeshPhysicalMaterial,
  MeshStandardNodeMaterial,
  Object3D,
  Texture,
  TextureLoader,
} from "three/webgpu";
import {
  abs,
  cos,
  dot,
  faceDirection,
  float,
  fract,
  mix,
  modelNormalMatrix,
  normalGeometry,
  normalize,
  positionGeometry,
  positionWorld,
  pow,
  sin,
  smoothstep,
  texture,
  transformDirection,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import perlinNoiseTextureUrl from "/perlin_noise_texture.webp?url";

export default class GrassV3 {
  private readonly GRASS_AREA_SIDE_SIZE = 8; // better if pow of 2 or even
  private readonly NUM_BLADES_PER_SIDE = 96; // better if pow of 2 or perfect square
  private readonly BLADE_WIDTH = 0.05;
  private readonly BLADE_HEIGHT = 1;
  private uTime = uniform(0);
  private noiseTexture: Texture;

  constructor(state: State) {
    const { scene } = state;

    const loader = new TextureLoader();
    this.noiseTexture = loader.load(perlinNoiseTextureUrl);

    // const geometry = this.createGeometry();
    // const material = this.createBladeMaterial();
    // const mesh = new Mesh(geometry, material);
    // scene.add(mesh);

    // const normalHelper = new VertexNormalsHelper(mesh, 0.1, 0xff0000);
    // scene.add(normalHelper);

    const instances = this.createInstances();
    scene.add(instances);
  }

  private createInstances() {
    const geometry = this.createGeometry();
    const material = this.createBladeMaterial();

    const instancesPerSide = 2;
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
    instances.receiveShadow = true;

    return instances;
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

  private material_curveNormals(
    materialNode: MeshPhongNodeMaterial | MeshBasicNodeMaterial,
  ) {
    // 1. Apply curvature across the blade width (UV.x)
    const sideFactor = uv().x.mul(2.0).sub(1.0); // -1 to 1 across the width
    const heightFactor = pow(uv().y, 2.0); // More curvature at the base
    const curvatureStrength = mix(0.4, 0.1, heightFactor);

    // 2. Simulate cylindrical normals
    let curvedNormal = normalize(
      vec3(sideFactor.mul(curvatureStrength), 0.0, 1.0),
    );

    // 3. Transform normals to world space
    curvedNormal = normalize(
      transformDirection(curvedNormal, modelNormalMatrix),
    );

    // 4. Correct for backface rendering
    curvedNormal = mix(
      curvedNormal,
      curvedNormal.negate(),
      float(faceDirection.lessThan(0.0)),
    );

    // 5. Apply the corrected normal to the material
    materialNode.normalNode = curvedNormal;
  }

  private material_addAmbientOcclusion(
    materialNode: MeshPhongNodeMaterial | MeshBasicNodeMaterial,
  ) {
    // 1. **Gentler Height-Based AO (Soft Grounding)**
    const baseAO = smoothstep(0.0, 0.5, positionGeometry.y).mul(0.2);
    // Softens the base darkening effect

    // 2. **Subtle Noise-Based Variation (Organic Patches)**
    const aoNoiseScale = 0.15;
    const aoNoiseUV = positionWorld.xz.mul(aoNoiseScale);
    const noiseSample = texture(this.noiseTexture, aoNoiseUV).r;
    const aoClustering = mix(0.85, 1.0, noiseSample);
    // Softer clustering

    // 3. **Increased Self-Shadowing Along Blade Curvature**
    const bendShadowStrength = 0.6; // Increased self-shadowing strength
    const bendShadow = float(1.0)
      .sub(abs(normalGeometry.x))
      .mul(bendShadowStrength);
    // Stronger shading on inner curves

    // 4. **Neighboring Blade Occlusion (More Depth)**
    const neighborNoiseScale = 0.08;
    const neighborNoiseUV = positionWorld.xz.mul(neighborNoiseScale);
    const neighborDensity = texture(this.noiseTexture, neighborNoiseUV).r;
    const neighborAO = mix(0.85, 1.0, neighborDensity);

    // 5. **Reduced AO on Backfaces (Brighter Backs)**
    const backfaceFactor = mix(1.0, 0.9, float(faceDirection.lessThan(0.0)));
    // Slight reduction in AO on the back

    // 6. **Combine All AO Effects with More Emphasis on Self-Shadowing**
    const combinedAO = mix(
      1.0,
      baseAO.mul(aoClustering).mul(bendShadow).mul(neighborAO),
      0.5, // Stronger blending of AO
    )
      .mul(backfaceFactor) // Reduce AO on backfaces
      .clamp(0.7, 1.0); // Keep it bright but with depth

    // 7. **Apply to Material**
    materialNode.aoNode = combinedAO;
  }

  private material_setDiffuseColor(
    materialNode: MeshPhongNodeMaterial | MeshBasicNodeMaterial,
  ) {
    // 1. **Base, Mid, and Tip Colors for a Smooth Gradient**
    const baseColor = vec3(0.05, 0.2, 0.01); // Deep green at the base
    const midColor = vec3(0.15, 0.35, 0.05); // Richer green for mid-blade
    const tipColor = vec3(0.45, 0.5, 0.1); // Soft yellow-green near the tip

    // 2. **Noise for Organic Dark Patches**
    const noiseScale = 0.25;
    const noiseSample = texture(
      this.noiseTexture,
      positionWorld.xz.mul(noiseScale),
    ).r;
    const darkPatchFactor = smoothstep(0.3, 0.7, noiseSample); // Emphasize dark spots

    const darkPatchColor = vec3(0.03, 0.15, 0.01); // Dark green for organic spots

    // 3. **Height-Based Color Blending (Base → Mid → Tip)**
    const heightFactor = pow(positionGeometry.y, 1.2); // More gradual transition
    const baseToMidBlend = mix(
      baseColor,
      midColor,
      smoothstep(0.0, 0.6, heightFactor),
    );
    const midToTipBlend = mix(
      baseToMidBlend,
      tipColor,
      smoothstep(0.4, 1.0, heightFactor),
    );

    // 4. **Overlay Dark Patches for Organic Variation**
    const organicColor = mix(
      midToTipBlend,
      darkPatchColor,
      darkPatchFactor.mul(0.3),
    );
    // Subtle dark patches blended in

    // 5. **Enhanced Subsurface Scattering (Soft Light Wrap)**
    const lightDirection = normalize(vec3(-0.3, 1.0, 0.2)); // Dawn light direction
    const lightWrap = 0.6; // Softer light spread
    const facingLightFactor = dot(normalGeometry, lightDirection).max(0.0);
    const subsurfaceEffect = mix(0.5, 1.0, facingLightFactor.mul(lightWrap));

    // 6. **Final Color Composition**
    const finalColor = organicColor.mul(subsurfaceEffect);

    // 7. **Apply to Material**
    materialNode.colorNode = finalColor;
  }

  private material_addWindMotion(
    materialNode: MeshPhongNodeMaterial | MeshBasicNodeMaterial,
  ) {
    // 1. **Blade-Level Noise Sampling (With Seamless Wrapping)**
    const bladeOrigin = vec2(positionWorld.x, positionWorld.z);
    const bladeNoiseScale = 0.05; // Large-scale wind
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
    const { clock } = state;
    this.uTime.value = clock.getElapsedTime();
  }
}
