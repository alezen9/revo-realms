import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import type { State } from "../Game";
import { realmConfig } from "../realm/config";
import {
  assetManager,
  eventsManager,
  sceneManager,
  shadowManager,
} from "../systems";

const DEFAULT_CASTER_COUNT = 3;
const MAX_CASTER_COUNT = 100;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TEST_CENTER_X = 150;
const TEST_CENTER_Z = 80;

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

const getTerrainHeight = (x: number, z: number) => {
  const { data, height, width } = assetManager.resources.heightmap.image;
  if (!data) throw new Error("Terrain heightmap is unavailable");
  const u = (x + realmConfig.HALF_MAP_SIZE) / realmConfig.MAP_SIZE;
  const v = 1 - (z + realmConfig.HALF_MAP_SIZE) / realmConfig.MAP_SIZE;
  const pixelX = Math.round(Math.max(0, Math.min(1, u)) * (width - 1));
  const pixelY = Math.round(Math.max(0, Math.min(1, v)) * (height - 1));
  return data[pixelX + pixelY * width];
};

const getBasePosition = (index: number, count: number) => {
  if (index < 3) {
    const x = TEST_CENTER_X + (index - 1) * 7;
    const z = TEST_CENTER_Z + (index === 2 ? 4 : -4);
    return new Vector3(x, getTerrainHeight(x, z) + 3.5, z);
  }

  const normalizedIndex = (index - 2) / Math.max(1, count - 2);
  const radius = 45 + Math.sqrt(normalizedIndex) * 250;
  const angle = index * GOLDEN_ANGLE;
  const x = Math.max(
    -realmConfig.HALF_MAP_SIZE + 12,
    Math.min(
      realmConfig.HALF_MAP_SIZE - 12,
      TEST_CENTER_X + Math.cos(angle) * radius,
    ),
  );
  const z = Math.max(
    -realmConfig.HALF_MAP_SIZE + 12,
    Math.min(
      realmConfig.HALF_MAP_SIZE - 12,
      TEST_CENTER_Z + Math.sin(angle) * radius,
    ),
  );
  return new Vector3(x, getTerrainHeight(x, z) + 3.5, z);
};

export class DynamicShadowTestRig {
  private basePositions: Vector3[] = [];
  private casters: Mesh[] = [];
  private elapsed = 0;

  constructor() {
    const root = new Group();
    const casterCount = getCasterCount();
    const geometries = [
      new SphereGeometry(1.25, 32, 16),
      new BoxGeometry(2, 2, 2),
      new TorusGeometry(1.5, 0.42, 16, 48),
    ];
    const materials = [
      new MeshStandardNodeMaterial({ color: new Color(0.95, 0.24, 0.12) }),
      new MeshStandardNodeMaterial({ color: new Color(0.12, 0.48, 0.95) }),
      new MeshStandardNodeMaterial({ color: new Color(0.95, 0.68, 0.12) }),
    ];

    for (let index = 0; index < casterCount; index++) {
      const type = index % geometries.length;
      const caster = new Mesh(geometries[type], materials[type]);
      caster.name = `Dynamic shadow test ${index + 1}`;
      this.casters.push(caster);
      this.basePositions.push(getBasePosition(index, casterCount));
      root.add(caster);
    }

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
    for (let index = 0; index < this.casters.length; index++) {
      const caster = this.casters[index];
      const base = this.basePositions[index];
      const phase = time * (0.35 + (index % 4) * 0.08) + index * 1.7;
      const movementRadius = index < 3 ? 3 : 1.5;
      caster.position.set(
        base.x + Math.cos(phase) * movementRadius,
        base.y + Math.sin(time * 0.8 + index) * 1.5,
        base.z + Math.sin(phase) * movementRadius,
      );
      caster.rotation.set(phase * 0.7, phase, phase * 0.45);
    }
  }
}
