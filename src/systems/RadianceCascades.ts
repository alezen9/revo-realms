import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
import {
  BoxGeometry,
  InstancedBufferAttribute,
  MeshBasicNodeMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Scene,
} from "three/webgpu";
import { attribute, vec4 } from "three/tsl";

type Probe = {
  position: Vector3;
  color: Color; // Stores light color at this probe
};

export default class RadianceCascades {
  private cascades: Probe[][] = []; // Array of cascaded probe grids
  private glowingObjects: Object3D[] = []; // Objects emitting light

  debugEnabled = false;
  debugGroup = new Group();

  constructor(scene: Scene) {
    this.initializeCascades();

    if (this.debugEnabled) {
      this.visualizeProbes();
      scene.add(this.debugGroup);
    }

    // CUBE
    const cube = new Mesh(
      new BoxGeometry(),
      new MeshLambertMaterial({
        emissive: "red",
        emissiveIntensity: 2,
      }),
    );
    cube.position.set(2, 0.5, -4);
    scene.add(cube);
    this.glowingObjects.push(cube);

    const sphere = new Mesh(
      new SphereGeometry(0.5),
      new MeshLambertMaterial({
        emissive: "green",
        emissiveIntensity: 1,
      }),
    );
    sphere.position.set(-2, 0.5, -1);
    scene.add(sphere);
    this.glowingObjects.push(sphere);
  }

  visualizeProbes(): void {
    const sphereGeometry = new SphereGeometry(0.025, 8, 8); // Small spheres
    const sphereMaterial = new MeshBasicNodeMaterial();
    sphereMaterial.colorNode = vec4(attribute("color"), 1); // Use per-instance colors

    const totalProbes = this.cascades.reduce(
      (sum, cascade) => sum + cascade.length,
      0,
    );

    const instancedMesh = new InstancedMesh(
      sphereGeometry,
      sphereMaterial,
      totalProbes,
    );

    const matrix = new Matrix4();
    const colors = new Float32Array(totalProbes * 3); // RGB for each instance

    let instanceIndex = 0;
    this.cascades.forEach((cascade) => {
      cascade.forEach((probe) => {
        // Set instance position
        matrix.setPosition(probe.position);
        instancedMesh.setMatrixAt(instanceIndex, matrix);

        // Set initial colors (black)
        colors[instanceIndex * 3] = probe.color.r;
        colors[instanceIndex * 3 + 1] = probe.color.g;
        colors[instanceIndex * 3 + 2] = probe.color.b;

        instanceIndex++;
      });
    });

    // Set colors as an instance attribute
    instancedMesh.geometry.setAttribute(
      "color",
      new InstancedBufferAttribute(colors, 3),
    );

    this.debugGroup.clear(); // Clear previous visualization
    this.debugGroup.add(instancedMesh);
  }

  updateProbeColors(): void {
    const instancedMesh = this.debugGroup.children[0] as InstancedMesh;

    if (!instancedMesh) return;

    const colors = instancedMesh.geometry.getAttribute(
      "color",
    ) as InstancedBufferAttribute;

    let instanceIndex = 0;
    this.cascades.forEach((cascade) => {
      cascade.forEach((probe) => {
        colors.array[instanceIndex * 3] = probe.color.r;
        colors.array[instanceIndex * 3 + 1] = probe.color.g;
        colors.array[instanceIndex * 3 + 2] = probe.color.b;

        instanceIndex++;
      });
    });

    colors.needsUpdate = true; // Mark the attribute for an update
  }

  initializeCascades(): void {
    const cascadeSizes = [32, 16, 8]; // Grid resolutions for near, mid, far
    const cascadeRanges = [10, 30, 60]; // World space coverage for each grid

    this.cascades = cascadeSizes.map((gridSize, index) => {
      const range = cascadeRanges[index];
      const step = range / gridSize; // Distance between probes
      const probes: Probe[] = [];

      for (let x = -range / 2; x < range / 2; x += step) {
        for (let y = 0; y < 5; y += step) {
          for (let z = -range / 2; z < range / 2; z += step) {
            probes.push({
              position: new Vector3(x, y, z),
              color: new Color(0, 0, 0), // Initialize as black
            });
          }
        }
      }
      return probes;
    });
  }

  addGlowingObject(object: Object3D): void {
    this.glowingObjects.push(object);
  }

  removeGlowingObject(object: Object3D): void {
    this.glowingObjects = this.glowingObjects.filter(
      (entry) => entry !== object,
    );
  }

  updateProbes(): void {
    this.cascades.forEach((cascade) => {
      cascade.forEach((probe) => {
        const probeColor = new Color(0, 0, 0); // Reset probe color

        this.glowingObjects.forEach((glowingObject) => {
          if (glowingObject instanceof Mesh) {
            const material = glowingObject.material as
              | MeshLambertMaterial
              | MeshStandardMaterial;

            // Ensure material has emissive properties
            if (material.emissive) {
              const distance = probe.position.distanceTo(
                glowingObject.position,
              );
              const falloff = 1 / (distance * distance + 0.1); // Simple quadratic falloff

              // Compute emissive contribution
              const emissiveColor = material.emissive.clone();
              if ((material as MeshStandardMaterial).emissiveIntensity) {
                emissiveColor.multiplyScalar(
                  (material as MeshStandardMaterial).emissiveIntensity,
                );
              }

              probeColor.add(emissiveColor.multiplyScalar(falloff));
            }
          }
        });

        // Clamp color values to avoid exceeding valid ranges
        probe.color.r = Math.min(1, Math.max(0, probeColor.r));
        probe.color.g = Math.min(1, Math.max(0, probeColor.g));
        probe.color.b = Math.min(1, Math.max(0, probeColor.b));

        probe.color.copy(probeColor);
      });
    });
  }

  applyLightingToPlayer(
    playerPosition: Vector3,
    maxProbes = 4,
  ): { colors: Color[]; directions: Vector3[] } {
    const probeContributions: {
      distance: number;
      color: Color;
      direction: Vector3;
    }[] = [];

    // Collect contributions from nearby probes
    this.cascades.forEach((cascade) => {
      cascade.forEach((probe) => {
        const distance = playerPosition.distanceTo(probe.position);
        if (distance > 10) return; // Ignore probes too far from the player

        const weight = 1 / (distance * distance + 0.1); // Distance falloff
        const direction = probe.position
          .clone()
          .sub(playerPosition)
          .normalize(); // Direction to the probe

        probeContributions.push({
          distance,
          color: probe.color.clone().multiplyScalar(weight),
          direction,
        });
      });
    });

    // Sort by distance and take the closest probes
    probeContributions.sort((a, b) => a.distance - b.distance);
    const closestProbes = probeContributions.slice(0, maxProbes);

    return {
      colors: closestProbes.map((probe) => probe.color),
      directions: closestProbes.map((probe) => probe.direction),
    };
  }
}
