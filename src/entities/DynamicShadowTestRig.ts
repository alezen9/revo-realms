import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Object3D,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import type { State } from "../Game";
import { eventsManager, sceneManager, shadowManager } from "../systems";

const DEFAULT_CASTER_COUNT = 3;
const MAX_CASTER_COUNT = 20;

const getCasterCount = () => {
  const value = new URLSearchParams(window.location.search).get(
    "shadowCasters",
  );
  if (!value) return DEFAULT_CASTER_COUNT;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_CASTER_COUNT)
    return DEFAULT_CASTER_COUNT;
  return count;
};

export class DynamicShadowTestRig {
  private casters: InstancedMesh[];
  private instanceIndices: number[];
  private transform = new Object3D();
  private elapsed = 0;

  constructor() {
    const root = new Group();
    const casterCount = getCasterCount();
    const instanceCounts = [0, 0, 0];
    for (let index = 0; index < casterCount; index++) {
      instanceCounts[index % instanceCounts.length]++;
    }

    this.casters = [
      new InstancedMesh(
        new SphereGeometry(1.25, 32, 16),
        new MeshStandardNodeMaterial({ color: new Color(0.95, 0.24, 0.12) }),
        instanceCounts[0],
      ),
      new InstancedMesh(
        new BoxGeometry(2, 2, 2),
        new MeshStandardNodeMaterial({ color: new Color(0.12, 0.48, 0.95) }),
        instanceCounts[1],
      ),
      new InstancedMesh(
        new TorusGeometry(1.5, 0.42, 16, 48),
        new MeshStandardNodeMaterial({ color: new Color(0.95, 0.68, 0.12) }),
        instanceCounts[2],
      ),
    ];
    this.instanceIndices = [0, 0, 0];
    for (const caster of this.casters) {
      caster.frustumCulled = false;
      caster.instanceMatrix.setUsage(DynamicDrawUsage);
    }

    root.add(...this.casters);
    this.updateTransforms();
    sceneManager.mainScene.add(root);
    shadowManager.register(root, {
      cast: true,
      mobility: "dynamic",
      receive: true,
    });
    eventsManager.on("engine-render-update", this.onEngineUpdate);
  }

  private onEngineUpdate = ({ delta }: State) => {
    this.elapsed += delta;
    this.updateTransforms();
  };

  private updateTransforms() {
    const time = this.elapsed;
    this.instanceIndices.fill(0);
    let casterIndex = 0;
    for (let type = 0; type < this.casters.length; type++) {
      casterIndex += this.casters[type].count;
    }
    for (let index = 0; index < casterIndex; index++) {
      const type = index % this.casters.length;
      const caster = this.casters[type];
      const instanceIndex = this.instanceIndices[type]++;

      if (index === 0) {
        this.transform.position.set(
          144 + Math.sin(time * 0.8) * 3.5,
          3.5 + Math.sin(time * 1.4) * 1.5,
          76,
        );
        this.transform.rotation.set(0, time, 0);
      } else if (index === 1) {
        this.transform.position.set(151, 3.5, 76 + Math.sin(time * 0.65) * 4);
        this.transform.rotation.set(time * 0.7, time * 1.1, time * 0.45);
      } else if (index === 2) {
        this.transform.position.set(
          156 + Math.cos(time * 0.55) * 3,
          4.5 + Math.sin(time * 0.9),
          84 + Math.sin(time * 0.55) * 3,
        );
        this.transform.rotation.set(Math.PI * 0.5 + time * 0.4, time * 0.8, 0);
      } else {
        const lane = index - 3;
        const angle = time * (0.35 + (lane % 4) * 0.08) + lane * 1.7;
        const radius = 4 + (lane % 5) * 1.4;
        this.transform.position.set(
          151 + Math.cos(angle) * radius,
          2.5 + Math.sin(time * 0.8 + lane) * 1.5,
          82 + Math.sin(angle) * radius,
        );
        this.transform.rotation.set(angle * 0.7, angle, angle * 0.45);
      }
      this.transform.updateMatrix();
      caster.setMatrixAt(instanceIndex, this.transform.matrix);
    }
    for (const caster of this.casters) {
      caster.instanceMatrix.needsUpdate = true;
    }
  }
}
