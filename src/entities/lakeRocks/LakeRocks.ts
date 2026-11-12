import { ColliderDesc } from "@dimforge/rapier3d";
import { InstancedMesh, Matrix4, Mesh } from "three";
import {
  float,
  mix,
  mrt,
  normalWorld,
  texture,
  uniform,
  uv,
  vec4,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  assets,
  debugPanel,
  graphics,
  lighting,
  physicsWorld,
  stage,
} from "../../systems";
import { RevoColliderType } from "../../systems/physics/colliderTypes";

const ROCKS = [
  "lake-rock-4",
  "lake-rock-1",
  "lake-rock-2",
  "lake-rock-3",
  "lake-rock-5",
];

const uniforms = {
  uDiffuseScale: uniform(1),
  uShadeDepth: uniform(0.8),
  uUvScale: uniform(1.25),
};

class LakeRocksMaterial extends MeshBasicNodeMaterial {
  constructor() {
    super();
    const rockUv = uv().mul(uniforms.uUvScale);
    const diffuse = texture(assets.resources.lakeRocksDiffuse, rockUv);
    const facingSun = normalWorld.dot(lighting.uSunDir.negate()).saturate();
    const shade = mix(float(1).sub(uniforms.uShadeDepth), 1, facingSun);
    const rockColor = diffuse.rgb.mul(uniforms.uDiffuseScale).mul(shade);
    this.colorNode = rockColor;

    const hemiRadiance = lighting.uHemiSkyColor.rgb.add(
      lighting.uHemiGroundColor.rgb,
    );
    const ambientRadiance = hemiRadiance.mul(lighting.uHemiIntensity.mul(0.5));
    const sunRadiance = lighting.uSunRadiance.rgb;
    const totalRadiance = sunRadiance.add(ambientRadiance).max(0.0001);
    const directFraction = sunRadiance.div(totalRadiance);
    this.mrtNode = mrt({
      directSun: vec4(rockColor.mul(directFraction), 1),
    });
  }
}

export class LakeRocks {
  private meshes: Mesh[] = [];
  private shadowSettings = { depthBias: 0 };

  constructor() {
    const { lakeRocksModel, lakeRocksPlacements } = assets.resources;
    const { buffer, byteOffset, byteLength } = lakeRocksPlacements;
    const matrices = new Float32Array(buffer, byteOffset, byteLength / 4);
    const rockCount = matrices.length / 16;

    const material = new LakeRocksMaterial();
    const matrix = new Matrix4();

    // the scatter writes the one rock that breaks the surface first
    const { geometry: surfacingGeometry } = assets.getMesh(
      "lake-rock-surfacing",
      lakeRocksModel,
    );
    const surfacingRock = new Mesh(surfacingGeometry, material);
    surfacingRock.name = "lake-rock-surfacing";
    matrix
      .fromArray(matrices, 0)
      .decompose(
        surfacingRock.position,
        surfacingRock.quaternion,
        surfacingRock.scale,
      );
    surfacingRock.updateMatrixWorld();
    this.meshes.push(surfacingRock);

    const capacity = Math.ceil(rockCount / ROCKS.length);
    const sunkRocks: InstancedMesh[] = [];
    for (const name of ROCKS) {
      const { geometry } = assets.getMesh(name, lakeRocksModel);
      const mesh = new InstancedMesh(geometry, material, capacity);
      mesh.name = name;
      mesh.count = 0;
      sunkRocks.push(mesh);
    }

    // the lake scatter sized each rock for the model at its place in the file
    for (let placementIndex = 1; placementIndex < rockCount; placementIndex++) {
      const mesh = sunkRocks[placementIndex % ROCKS.length];
      matrix.fromArray(matrices, placementIndex * 16);
      mesh.setMatrixAt(mesh.count, matrix);
      mesh.count++;
    }

    for (const mesh of sunkRocks) {
      const hasRocks = mesh.count > 0;
      if (!hasRocks) continue;
      this.meshes.push(mesh);
    }
    for (const mesh of this.meshes) {
      stage.mainScene.add(mesh);
      graphics.vsmPass.registerCaster(mesh, this.shadowSettings);
    }

    this.createSurfacingCollider(surfacingRock);
    this.debug();
  }

  private createSurfacingCollider(rock: Mesh) {
    const { geometry, position, quaternion, scale } = rock;
    const vertices = geometry.getAttribute("position").array;
    const hull = Float32Array.from(vertices, (value) => value * scale.x);
    const colliderDesc = ColliderDesc.convexHull(hull);
    if (!colliderDesc) throw new Error("Surfacing lake rock has no hull");
    colliderDesc.setTranslation(...position.toArray()).setRotation(quaternion);
    const collider = physicsWorld.world.createCollider(colliderDesc);
    collider.userData = { type: RevoColliderType.Stone };
  }

  private debug() {
    const folder = debugPanel.panel.addFolder({
      title: "🪨 Lake rocks",
      expanded: false,
    });
    folder.addBinding(uniforms.uDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
      max: 4,
    });
    folder.addBinding(uniforms.uUvScale, "value", {
      label: "UV scale",
      min: 0.1,
      max: 8,
      step: 0.05,
    });
    folder.addBinding(uniforms.uShadeDepth, "value", {
      label: "Shade depth",
      min: 0,
      max: 1,
      step: 0.01,
    });
    folder
      .addBinding(this.shadowSettings, "depthBias", {
        label: "Shadow bias (m)",
        min: 0,
        max: 0.5,
        step: 0.005,
      })
      .on("change", ({ value }) => {
        for (const mesh of this.meshes)
          graphics.vsmPass.setCasterDepthBias(mesh, value);
      });
  }
}
