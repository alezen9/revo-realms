import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  LOD,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from "three";
import { sceneManager } from "../../systems/SceneManager";

const getConfig = () => {
  const BLADE_WIDTH = 0.075;
  const BLADE_HEIGHT = 1.45;
  const TILE_SIZE = 25;
  const BLADES_PER_SIDE = 100;
  return {
    BLADE_WIDTH,
    BLADE_HEIGHT,
    BLADE_BOUNDING_SPHERE_RADIUS: BLADE_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    BLADES_PER_SIDE,
    COUNT: BLADES_PER_SIDE * BLADES_PER_SIDE,
    SPACING: TILE_SIZE / BLADES_PER_SIDE,
  };
};
const grassConfig = getConfig();

export default class NewGrass {
  private material = new MeshStandardMaterial({ color: "green" });

  private materials = [
    new MeshBasicMaterial({ color: "green" }),
    new MeshBasicMaterial({ color: "orange" }),
    new MeshBasicMaterial({ color: "red" }),
  ];

  private group = new Group();
  constructor() {
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const tile = this.createTile();
        const x = grassConfig.TILE_SIZE * i - grassConfig.TILE_HALF_SIZE;
        const z = grassConfig.TILE_SIZE * j - grassConfig.TILE_HALF_SIZE;
        tile.position.set(x, 0, z);
        this.group.add(tile);
      }
    }
    sceneManager.scene.add(this.group);
  }

  private createHighBladeGeometry() {
    //    G
    //   / \
    //  F---F'
    // /     \
    // C-------D
    // |   \   |
    // A-------B

    const halfWidth = grassConfig.BLADE_WIDTH / 2;
    const quarterWidth = halfWidth / 2;
    const segmentHeight = grassConfig.BLADE_HEIGHT / 4;

    const positions = new Float32Array([
      // A, B
      -halfWidth,
      0,
      0,
      halfWidth,
      0,
      0,
      // C, D
      -quarterWidth * 1.25,
      segmentHeight * 1,
      0,
      quarterWidth * 1.25,
      segmentHeight * 1,
      0,
      // F, F'
      -quarterWidth * 0.75,
      segmentHeight * 2,
      0,
      quarterWidth * 0.75,
      segmentHeight * 2,
      0,
      // G (tip)
      0,
      segmentHeight * 3,
      0,
    ]);

    const uvs = new Float32Array([
      // A, B
      0,
      0,
      1,
      0,
      // C, D
      0.25,
      segmentHeight * 1,
      0.75,
      segmentHeight * 1,
      // F, F'
      0.375,
      segmentHeight * 2,
      0.625,
      segmentHeight * 2,
      // G
      0.5,
      segmentHeight * 3,
    ]);

    const indices = new Uint16Array([
      // A-B-D, A-D-C
      0, 1, 3, 0, 3, 2,
      // C-D-F', C-F'-F
      2, 3, 5, 2, 5, 4,
      // F-F'-G
      4, 5, 6,
    ]);

    // Angles per segment
    const angle1 = (25 * Math.PI) / 180;
    const angle2 = (15 * Math.PI) / 180;
    const angle3 = (8 * Math.PI) / 180;

    const cos1 = Math.cos(angle1);
    const sin1 = Math.sin(angle1);

    const cos2 = Math.cos(angle2);
    const sin2 = Math.sin(angle2);

    const cos3 = Math.cos(angle3);
    const sin3 = Math.sin(angle3);

    const normals = new Float32Array([
      // A
      -cos1,
      sin1,
      0,
      // B
      cos1,
      sin1,
      0,
      // C
      -cos2,
      sin2,
      0,
      // D
      cos2,
      sin2,
      0,
      // F
      -cos3,
      sin3,
      0,
      // F'
      cos3,
      sin3,
      0,
      // G (tip)
      0.0,
      1.0,
      0,
    ]);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));

    return geometry;
  }

  private createMidBladeGeometry() {
    //    E
    //   /  \
    //  C----D
    // |  \   |
    // A------B
    const halfWidth = grassConfig.BLADE_WIDTH / 2;
    const quarterWidth = halfWidth / 2;
    const segmentHeight = grassConfig.BLADE_HEIGHT / 2;
    const positions = new Float32Array([
      -halfWidth,
      0,
      0, // A
      halfWidth,
      0,
      0, // B
      -quarterWidth,
      segmentHeight * 1,
      0, // C
      quarterWidth,
      segmentHeight * 1,
      0, // D
      0,
      segmentHeight * 2,
      0, // E
    ]);
    const uvs = new Float32Array([
      0,
      0, // A
      1,
      0, // B
      0.25,
      segmentHeight * 1, // C
      0.75,
      segmentHeight * 1, // D
      0.5,
      segmentHeight * 2, // E
    ]);

    const indices = new Uint16Array([
      // A-B-D A-D-C
      0, 1, 3, 0, 3, 2,
      // C-D-E
      2, 3, 4,
    ]);

    const angleDeg1 = 25;
    const angleRad1 = (angleDeg1 * Math.PI) / 180;
    const cosTheta1 = Math.cos(angleRad1);
    const sinTheta1 = Math.sin(angleRad1);

    const angleDeg2 = 15;
    const angleRad2 = (angleDeg2 * Math.PI) / 180;
    const cosTheta2 = Math.cos(angleRad2);
    const sinTheta2 = Math.sin(angleRad2);

    const normals = new Float32Array([
      -cosTheta1,
      sinTheta1,
      0, // A
      cosTheta1,
      sinTheta1,
      0, // B
      -cosTheta2,
      sinTheta2,
      0, // C
      cosTheta2,
      sinTheta2,
      0, // D
      0.0,
      1.0,
      0, // E (Tip remains straight)
    ]);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    return geometry;
  }

  private createLowBladeGeometry() {
    const halfWidth = grassConfig.BLADE_WIDTH / 2;
    const height = grassConfig.BLADE_HEIGHT;

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

    const uvs = new Float32Array([
      0,
      0, // A
      1,
      0, // B
      0.5,
      1, // C
    ]);

    const angleDeg1 = 25;
    const angleRad1 = (angleDeg1 * Math.PI) / 180;
    const cosTheta1 = Math.cos(angleRad1);
    const sinTheta1 = Math.sin(angleRad1);

    const normals = new Float32Array([
      -cosTheta1,
      sinTheta1,
      0, // A
      cosTheta1,
      sinTheta1,
      0, // B
      0.0,
      1.0,
      0, // C (Tip remains straight)
    ]);

    const indices = new Uint16Array([0, 1, 2]);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    return geometry;
  }

  private createTile() {
    const highGeom = this.createHighBladeGeometry();
    const midGeom = this.createMidBladeGeometry();
    const lowGeom = this.createLowBladeGeometry();

    const lod = new LOD();

    const high = new InstancedMesh(
      highGeom,
      this.materials[0],
      grassConfig.COUNT,
    );
    const mid = new InstancedMesh(
      midGeom,
      this.materials[1],
      grassConfig.COUNT,
    );
    const low = new InstancedMesh(
      lowGeom,
      this.materials[2],
      grassConfig.COUNT,
    );

    const dummy = new Object3D();
    const grid = grassConfig.BLADES_PER_SIDE;
    const n = grassConfig.TILE_SIZE;
    const cell = n / grid;

    for (let i = 0; i < grassConfig.COUNT; i++) {
      const gx = i % grid;
      const gz = Math.floor(i / grid);

      // jittered position within each cell, centered around (0,0)
      const x = -n / 2 + (gx + Math.random()) * cell;
      const z = -n / 2 + (gz + Math.random()) * cell;

      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0); // random yaw

      dummy.updateMatrix();
      high.setMatrixAt(i, dummy.matrix);
      mid.setMatrixAt(i, dummy.matrix);
      low.setMatrixAt(i, dummy.matrix);
    }

    high.instanceMatrix.needsUpdate = true;
    mid.instanceMatrix.needsUpdate = true;
    low.instanceMatrix.needsUpdate = true;

    lod.addLevel(high, 0);
    lod.addLevel(mid, 50);
    lod.addLevel(low, 75);

    return lod;
  }
}
