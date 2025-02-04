import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  MathUtils,
  Object3D,
  Vector3,
} from "three";
import { State } from "../Game";
import { uniform } from "three/tsl";
import GrassMaterial from "../materials/GrassMaterial";

export default class GrassV2 {
  private readonly TILE_SIZE = 32; // better if pow of 2 or even
  private readonly NUM_BLADES_PER_SIDE = 256; // better if pow of 2 or perfect square
  private readonly BLADE_WIDTH = 0.05;
  private readonly BLADE_HEIGHT = 0.75;

  private uTime = uniform(0);

  constructor(scene: State["scene"]) {
    const group = new Group();
    group.add(this.createGrasTile(new Vector3(0, 0, 0)));
    scene.add(group);
  }

  private createGrassBladeGeometry(): BufferGeometry {
    /**
     *        G
     *      /   \
     *    E ------ F
     *    |   /    |
     *    C ------ D
     *    |   /    |
     *    A ------ B
     *
     *  - Bottom Quad: A-B-D-C (2 triangles)
     *  - Top Quad: C-D-F-E (2 triangles)
     *  - Tip:         E-F-G   (1 triangle)
     *
     *  Total: 5 triangles for smooth mid-definition bending.
     */

    const halfWidth = this.BLADE_WIDTH / 2;
    const height = this.BLADE_HEIGHT;
    const numSegments = 3;

    const segmentHeight = height / numSegments;

    const positions = new Float32Array([
      -halfWidth,
      0,
      0, // A - 0
      halfWidth,
      0,
      0, // B - 1
      -halfWidth,
      segmentHeight,
      0, // C - 2
      halfWidth,
      segmentHeight,
      0, // D - 3
      -halfWidth,
      segmentHeight * 2,
      0, // E - 4
      halfWidth,
      segmentHeight * 2,
      0, // F - 5
      0,
      height,
      0, // G - 6
    ]);

    const indices = new Uint16Array([
      // Bottom Quad (A-B-D, A-D-C)
      0, 1, 3, 0, 3, 2,
      // Top Quad (C-D-F, C-F-E)
      2, 3, 5, 2, 5, 4,
      // Tip (E-F-G)
      4, 5, 6,
    ]);

    const uvSegmentHeight = 1 / numSegments;

    const uvs = new Float32Array([
      0,
      0, // A
      1,
      0, // B
      0,
      uvSegmentHeight, // C
      1,
      uvSegmentHeight, // D
      0,
      uvSegmentHeight * 2, // E
      1,
      uvSegmentHeight * 2, // F
      0.5,
      1, // G
    ]);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    return geometry;
  }

  private createGrasTile(position = new Vector3(0)) {
    const bladesPerSide = this.NUM_BLADES_PER_SIDE;
    const totalBlades = Math.pow(bladesPerSide, 2);

    const geometry = this.createGrassBladeGeometry();
    const instances = new InstancedMesh(
      geometry,
      new GrassMaterial({ uTime: this.uTime }),
      totalBlades,
    );

    const tileSize = this.TILE_SIZE;
    const halfTileSize = tileSize / 2;
    const spacing = tileSize / bladesPerSide;

    const dummyObj = new Object3D();

    let instanceIdx = 0;
    for (let rowIdx = 0; rowIdx < bladesPerSide; rowIdx++) {
      const offsetZ =
        position.z +
        -halfTileSize +
        rowIdx * spacing +
        Math.random() * spacing * 0.5;
      for (let colIdx = 0; colIdx < bladesPerSide; colIdx++) {
        const offsetX =
          position.x +
          -halfTileSize +
          colIdx * spacing +
          Math.random() * spacing * 0.5;

        // Random rotation for variation
        const rotationAngle = MathUtils.randFloat(-1, 1);
        const heightScale = MathUtils.randFloat(0.5, 1.25);
        const additionalOffsetZ = MathUtils.randFloat(
          -spacing / 3,
          spacing / 3,
        );
        const additionalOffsetX = MathUtils.randFloat(
          -spacing / 3,
          spacing / 3,
        );

        dummyObj.position.set(
          offsetX + additionalOffsetX,
          0,
          offsetZ + additionalOffsetZ,
        );
        dummyObj.rotation.set(0, rotationAngle, 0);
        dummyObj.scale.set(1, heightScale, 1);

        dummyObj.updateMatrix();

        instances.setMatrixAt(instanceIdx, dummyObj.matrix);

        instanceIdx++;
      }
    }

    return instances;
  }

  update(state: State) {
    const { clock } = state;
    this.uTime.value = clock.getElapsedTime();
  }
}
