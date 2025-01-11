import {
  Texture,
  TextureLoader,
  ConeGeometry,
  InstancedMesh,
  Object3D,
  MeshStandardMaterial,
} from "three";
import { State } from "../core/Engine";
import perlinNoiseTextureUrl from "/perlin_noise_texture.png?url";
import {
  float,
  fract,
  mix,
  mod,
  mul,
  positionGeometry,
  positionLocal,
  positionWorld,
  remap,
  rotate,
  sin,
  smoothstep,
  step,
  texture,
  uniform,
  uv,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import {
  DoubleSide,
  MeshBasicMaterial,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
} from "three/webgpu";

export default class Grass {
  private readonly GRASS_AREA_SIZE = 1;
  private readonly BLADES_COUNT = 1;
  private readonly BLADE_HEIGHT = 3;
  private readonly BLADE_RADIUS = 0.2;
  private noiseTexture: Texture;
  private uTime = uniform(0);

  constructor(state: State) {
    const { scene } = state;
    const loader = new TextureLoader();
    this.noiseTexture = loader.load(perlinNoiseTextureUrl);

    const blades = this.createBlades();
    scene.add(blades);
  }

  private createBladeGeometry() {
    const geometry = new ConeGeometry(
      this.BLADE_RADIUS,
      this.BLADE_HEIGHT,
      3,
      1,
      true,
    );
    return geometry;
  }

  private createBladeMaterial() {
    const materialNode = new MeshBasicNodeMaterial();

    const baseColor = vec3(0.1, 0.2, 0.1); // Dark green
    const tipColor = vec3(0.5, 0.8, 0.3); // Light green
    const colorFactor = smoothstep(0, 2.5, positionLocal.y);
    const color = mix(baseColor, tipColor, colorFactor);
    materialNode.colorNode = color;

    const variance = this.uTime.mul(0.5);
    const noise = texture(this.noiseTexture, uv().mul(variance)).r;
    const multiplier = step(this.BLADE_HEIGHT / 2, positionLocal.y);
    const position = vec3(
      positionWorld.x.add(noise.mul(multiplier)),
      positionWorld.y,
      positionWorld.z.add(noise.mul(multiplier)),
    );

    materialNode.positionNode = position;
    return materialNode;
  }

  private createBlades() {
    const geometry = this.createBladeGeometry();
    const material = this.createBladeMaterial();

    const bladesPerSide = Math.sqrt(this.BLADES_COUNT);
    const instances = new InstancedMesh(geometry, material, this.BLADES_COUNT);

    const cellSize = this.GRASS_AREA_SIZE / bladesPerSide;
    const halfCellSize = cellSize / 2;
    const halfAreaSize = this.GRASS_AREA_SIZE / 2;
    const dummyObject = new Object3D();

    let instanceIndex = 0;

    // Scatter blades in a grid
    for (let rowIdx = 0; rowIdx < bladesPerSide; rowIdx++) {
      for (let colIdx = 0; colIdx < bladesPerSide; colIdx++) {
        // Base position within the grid cell
        const xPos = rowIdx * cellSize - halfAreaSize + halfCellSize;
        const zPos = colIdx * cellSize - halfAreaSize + halfCellSize;

        // Add slight random offsets within the cell
        const randomOffsetX = Math.random() * cellSize - halfCellSize;
        const randomOffsetZ = Math.random() * cellSize - halfCellSize;

        // Set position and random rotation for the blade
        dummyObject.position.set(xPos + randomOffsetX, 0, zPos + randomOffsetZ);
        // dummyObject.rotation.y = Math.random() * Math.PI * 2; // Random rotation around Y-axis
        dummyObject.scale.set(1, Math.random() * 0.5 + 0.75, 1); // Random height
        dummyObject.updateMatrix(); // Update transformation matrix

        // Apply transformation to the instance
        instances.setMatrixAt(instanceIndex++, dummyObject.matrix);
      }
    }

    // Ensure updates are applied to the instance matrix
    instances.instanceMatrix.needsUpdate = true;

    return instances;
  }

  update(state: State) {
    const { clock } = state;

    this.uTime.value = clock.getElapsedTime();
  }
}

// createGrassMaterial() {
//   const materialNode = new MeshStandardNodeMaterial({
//     color: 0x228b22, // Default green
//   });

//   //   const vWeight = varying()
//   const noise = texture(this.noiseTexture, uv()).r

//   materialNode.positionNode = vec3(positionWorld.x, positionWorld.y.add(noise), positionWorld.z)

//   tslMaterial.onBeforeCompile = (shader) => {
//     shader.vertexShader = shader.vertexShader.replace(
//       "#include <common>",
//       `
//       #include <common>
//       uniform float uTime;
//       varying float vHeight;

//       // Perlin noise or any noise function
//       float noise(vec2 p) {
//         return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
//       }

//       `
//     );

//     shader.vertexShader = shader.vertexShader.replace(
//       "#include <begin_vertex>",
//       `
//       #include <begin_vertex>
//       transformed.z += sin(position.y * 10.0 + uTime) * 0.05; // Wind effect
//       `
//     );

//     shader.fragmentShader = shader.fragmentShader.replace(
//       "#include <dithering_fragment>",
//       `
//       #include <dithering_fragment>
//       gl_FragColor.rgb *= vHeight; // Fade blades based on height
//       `
//     );

//     shader.uniforms.uTime = { value: 0 };
//   };

//   return tslMaterial;
// }
