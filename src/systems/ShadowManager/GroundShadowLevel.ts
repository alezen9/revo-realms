import {
  NoColorSpace,
  RedFormat,
  RepeatWrapping,
  UnsignedByteType,
  Vector2,
} from "three";
import { type ComputeNode, StorageTexture } from "three/webgpu";
import { uniform } from "three/tsl";
import type { GroundShadowLevelSettings } from "./ShadowSettings";

export type GroundShadowBakeRect = {
  height: number;
  minX: number;
  minZ: number;
  width: number;
};

export class GroundShadowLevel {
  readonly settings: GroundShadowLevelSettings;
  readonly texture: StorageTexture;
  readonly uHas = uniform(0);
  readonly uPreviousMin = uniform(new Vector2());
  readonly uMin = uniform(new Vector2());
  readonly uSize = uniform(0);
  readonly uTransition = uniform(1);
  readonly uBakeMin = uniform(new Vector2());
  readonly uBakeSize = uniform(0);
  readonly uBakeRectMin = uniform(new Vector2());
  readonly uBakeRectWidth = uniform(0);
  readonly uBlendDistance = uniform(0);
  bakeCompute?: ComputeNode;
  bakeRects: GroundShadowBakeRect[] = [];
  centerX = Number.NaN;
  centerZ = Number.NaN;
  private isValid = false;
  private canTransition = false;

  constructor(settings: GroundShadowLevelSettings) {
    this.settings = settings;
    this.texture = new StorageTexture(
      settings.textureSize,
      settings.textureSize,
    );
    this.texture.name = `shadows.ground.${settings.name}`;
    this.texture.colorSpace = NoColorSpace;
    this.texture.format = RedFormat;
    this.texture.type = UnsignedByteType;
    this.texture.generateMipmaps = false;
    this.texture.wrapS = RepeatWrapping;
    this.texture.wrapT = RepeatWrapping;
    this.uSize.value = settings.size;
    this.uBakeSize.value = settings.size;
    this.uBakeRectWidth.value = settings.textureSize;
    this.uBlendDistance.value = settings.blendDistance;
  }

  updateCenter(x: number, z: number) {
    const { recenterDistance } = this.settings;
    const isInsideCurrentRegion =
      Number.isFinite(this.centerX) &&
      Math.abs(x - this.centerX) <= recenterDistance &&
      Math.abs(z - this.centerZ) <= recenterDistance;
    if (isInsideCurrentRegion) return false;
    this.centerX = Math.round(x / recenterDistance) * recenterDistance;
    this.centerZ = Math.round(z / recenterDistance) * recenterDistance;
    return true;
  }

  prepareBake() {
    const halfSize = this.settings.size * 0.5;
    this.uBakeMin.value.set(this.centerX - halfSize, this.centerZ - halfSize);
    this.uBakeSize.value = this.settings.size;
    this.canTransition =
      this.isValid && this.uSize.value === this.uBakeSize.value;
    this.bakeRects = this.getBakeRects();
    this.uBlendDistance.value = this.settings.blendDistance;
  }

  markAvailable() {
    if (this.canTransition) {
      this.uPreviousMin.value.copy(this.uMin.value);
      this.uTransition.value = 0;
    } else {
      this.uPreviousMin.value.copy(this.uBakeMin.value);
      this.uTransition.value = 1;
    }
    this.uMin.value.copy(this.uBakeMin.value);
    this.uSize.value = this.uBakeSize.value;
    this.uHas.value = 1;
    this.isValid = true;
  }

  invalidate() {
    this.uHas.value = 0;
    this.isValid = false;
    this.uTransition.value = 1;
  }

  update(delta: number) {
    if (this.uTransition.value === 1) return;
    const { transitionDuration } = this.settings;
    if (transitionDuration === 0) {
      this.uTransition.value = 1;
      return;
    }
    this.uTransition.value = Math.min(
      1,
      this.uTransition.value + delta / transitionDuration,
    );
  }

  private getBakeRects() {
    const minX = this.uBakeMin.value.x;
    const minZ = this.uBakeMin.value.y;
    const size = this.uBakeSize.value;
    const fullRect = { minX, minZ, width: size, height: size };
    if (!this.isValid || this.uSize.value !== size) return [fullRect];

    const oldMinX = this.uMin.value.x;
    const oldMinZ = this.uMin.value.y;
    const overlapMinX = Math.max(minX, oldMinX);
    const overlapMinZ = Math.max(minZ, oldMinZ);
    const overlapMaxX = Math.min(minX + size, oldMinX + size);
    const overlapMaxZ = Math.min(minZ + size, oldMinZ + size);
    if (overlapMinX >= overlapMaxX || overlapMinZ >= overlapMaxZ) {
      return [fullRect];
    }

    const rects: GroundShadowBakeRect[] = [];
    if (minX < overlapMinX) {
      rects.push({
        minX,
        minZ,
        width: overlapMinX - minX,
        height: size,
      });
    }
    if (overlapMaxX < minX + size) {
      rects.push({
        minX: overlapMaxX,
        minZ,
        width: minX + size - overlapMaxX,
        height: size,
      });
    }

    const overlapWidth = overlapMaxX - overlapMinX;
    if (minZ < overlapMinZ) {
      rects.push({
        minX: overlapMinX,
        minZ,
        width: overlapWidth,
        height: overlapMinZ - minZ,
      });
    }
    if (overlapMaxZ < minZ + size) {
      rects.push({
        minX: overlapMinX,
        minZ: overlapMaxZ,
        width: overlapWidth,
        height: minZ + size - overlapMaxZ,
      });
    }
    return rects;
  }
}
