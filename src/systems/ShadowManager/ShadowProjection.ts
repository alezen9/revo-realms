import { Box3, Vector3 } from "three";
import { realmConfig } from "../../realm/config";
import type { AssetManager } from "../AssetManager/AssetManager";
import type { LightingManager } from "../LightingManager";
import type { ShadowCasterRegistry } from "./ShadowCasterRegistry";
import { SHADOW_PADDING, shadowSettings } from "./ShadowSettings";

export class ShadowProjection {
  private assetManager: AssetManager;
  private lightingManager: LightingManager;
  private registry: ShadowCasterRegistry;
  private worldBounds = new Box3();
  private localBounds = new Box3();
  private boundsSize = new Vector3();
  private boundsCenter = new Vector3();
  private viewCorner = new Vector3();

  constructor(
    assetManager: AssetManager,
    lightingManager: LightingManager,
    registry: ShadowCasterRegistry,
  ) {
    this.assetManager = assetManager;
    this.lightingManager = lightingManager;
    this.registry = registry;
  }

  fitGlobal() {
    this.updateWorldBounds();
    this.worldBounds.getCenter(this.boundsCenter);
    this.fitCamera(
      this.worldBounds,
      this.worldBounds,
      SHADOW_PADDING,
      false,
    );
  }

  fitLocal(centerX: number, centerZ: number) {
    this.updateWorldBounds();
    const halfSize = shadowSettings.localSize * 0.5;
    this.localBounds.min.set(
      centerX - halfSize,
      this.worldBounds.min.y,
      centerZ - halfSize,
    );
    this.localBounds.max.set(
      centerX + halfSize,
      this.worldBounds.max.y,
      centerZ + halfSize,
    );
    this.localBounds.getCenter(this.boundsCenter);
    this.fitCamera(this.localBounds, this.worldBounds, 0, true);
  }

  private updateWorldBounds() {
    const minHeight = this.assetManager.resources.heightmap.userData.min ?? -32;
    const maxHeight = this.assetManager.resources.heightmap.userData.max ?? 64;
    this.worldBounds.min.set(
      -realmConfig.HALF_MAP_SIZE,
      minHeight,
      -realmConfig.HALF_MAP_SIZE,
    );
    this.worldBounds.max.set(
      realmConfig.HALF_MAP_SIZE,
      maxHeight,
      realmConfig.HALF_MAP_SIZE,
    );
    this.registry.expandBounds(this.worldBounds);
  }

  private fitCamera(
    projectionBounds: Box3,
    depthBounds: Box3,
    projectionPadding: number,
    isStabilized: boolean,
  ) {
    this.worldBounds.getSize(this.boundsSize);
    const lightDistance = this.boundsSize.length() + SHADOW_PADDING * 2;
    const { sunLight } = this.lightingManager;
    sunLight.target.position.copy(this.boundsCenter);
    sunLight.target.updateMatrixWorld();
    sunLight.position
      .copy(this.lightingManager.sunDirection)
      .multiplyScalar(-lightDistance)
      .add(this.boundsCenter);
    sunLight.updateMatrixWorld();

    const camera = sunLight.shadow.camera;
    camera.position.copy(sunLight.position);
    camera.lookAt(this.boundsCenter);
    camera.updateMatrixWorld();

    let left = Infinity;
    let right = -Infinity;
    let bottom = Infinity;
    let top = -Infinity;
    for (let index = 0; index < 8; index++) {
      this.viewCorner
        .set(
          index & 1 ? projectionBounds.max.x : projectionBounds.min.x,
          index & 2 ? projectionBounds.max.y : projectionBounds.min.y,
          index & 4 ? projectionBounds.max.z : projectionBounds.min.z,
        )
        .applyMatrix4(camera.matrixWorldInverse);
      left = Math.min(left, this.viewCorner.x);
      right = Math.max(right, this.viewCorner.x);
      bottom = Math.min(bottom, this.viewCorner.y);
      top = Math.max(top, this.viewCorner.y);
    }

    let near = Infinity;
    let far = -Infinity;
    for (let index = 0; index < 8; index++) {
      this.viewCorner
        .set(
          index & 1 ? depthBounds.max.x : depthBounds.min.x,
          index & 2 ? depthBounds.max.y : depthBounds.min.y,
          index & 4 ? depthBounds.max.z : depthBounds.min.z,
        )
        .applyMatrix4(camera.matrixWorldInverse);
      const depth = -this.viewCorner.z;
      near = Math.min(near, depth);
      far = Math.max(far, depth);
    }

    const centerX = (left + right) * 0.5;
    const centerY = (bottom + top) * 0.5;
    const halfWidth = (right - left) * 0.5;
    const halfHeight = (top - bottom) * 0.5;
    let stableCenterX = centerX;
    let stableCenterY = centerY;
    if (isStabilized) {
      const texelX = (halfWidth * 2) / shadowSettings.resolution;
      const texelY = (halfHeight * 2) / shadowSettings.resolution;
      stableCenterX = Math.round(centerX / texelX) * texelX;
      stableCenterY = Math.round(centerY / texelY) * texelY;
    }
    camera.left = stableCenterX - halfWidth - projectionPadding;
    camera.right = stableCenterX + halfWidth + projectionPadding;
    camera.bottom = stableCenterY - halfHeight - projectionPadding;
    camera.top = stableCenterY + halfHeight + projectionPadding;
    camera.near = Math.max(0.1, near - SHADOW_PADDING);
    camera.far = far + SHADOW_PADDING;
    camera.updateProjectionMatrix();
  }
}
