import { Box3, Mesh, Vector3 } from "three";
import { StorageBufferAttribute } from "three/webgpu";
import {
  encodeShadowPageKey,
  SHADOW_PAGE_LEVEL_COUNT,
  type ShadowPageCoordinates,
} from "./ShadowPageCoordinates";
import {
  SHADOW_MINIMUM_PAGE_COORDINATE,
  SHADOW_PAGE_GRID_SIZE,
} from "./ShadowPageRequests";

export const DYNAMIC_SHADOW_PAGE_CAPACITY = 16;

export class DynamicShadowPages {
  private coordinates: ShadowPageCoordinates;
  private requestValues = new Uint32Array(DYNAMIC_SHADOW_PAGE_CAPACITY);
  private counterValues = new Uint32Array(1);
  private requestList = new StorageBufferAttribute(this.requestValues, 1);
  private counters = new StorageBufferAttribute(this.counterValues, 1);
  private bounds = new Box3();
  private corner = new Vector3();

  constructor(coordinates: ShadowPageCoordinates) {
    this.coordinates = coordinates;
  }

  get requestListAttribute() {
    return this.requestList;
  }

  get counterAttribute() {
    return this.counters;
  }

  update(caster: Mesh | undefined, sunDirection: Vector3) {
    let requestCount = 0;

    if (caster) {
      caster.updateWorldMatrix(true, false);
      this.bounds.setFromObject(caster, true);
      for (let level = 0; level < SHADOW_PAGE_LEVEL_COUNT; level++) {
        let minimumPageX = Number.POSITIVE_INFINITY;
        let maximumPageX = Number.NEGATIVE_INFINITY;
        let minimumPageY = Number.POSITIVE_INFINITY;
        let maximumPageY = Number.NEGATIVE_INFINITY;

        for (let x = 0; x < 2; x++) {
          for (let y = 0; y < 2; y++) {
            for (let z = 0; z < 2; z++) {
              this.corner.set(
                x === 0 ? this.bounds.min.x : this.bounds.max.x,
                y === 0 ? this.bounds.min.y : this.bounds.max.y,
                z === 0 ? this.bounds.min.z : this.bounds.max.z,
              );
              const address = this.coordinates.computeAddress(
                this.corner,
                sunDirection,
                level,
              );
              minimumPageX = Math.min(minimumPageX, address.pageX);
              maximumPageX = Math.max(maximumPageX, address.pageX);
              minimumPageY = Math.min(minimumPageY, address.pageY);
              maximumPageY = Math.max(maximumPageY, address.pageY);
            }
          }
        }

        const minimumGridPage = SHADOW_MINIMUM_PAGE_COORDINATE;
        const maximumGridPage =
          SHADOW_MINIMUM_PAGE_COORDINATE + SHADOW_PAGE_GRID_SIZE - 1;
        minimumPageX = Math.max(minimumGridPage, minimumPageX);
        maximumPageX = Math.min(maximumGridPage, maximumPageX);
        minimumPageY = Math.max(minimumGridPage, minimumPageY);
        maximumPageY = Math.min(maximumGridPage, maximumPageY);

        for (
          let pageY = minimumPageY;
          pageY <= maximumPageY && requestCount < DYNAMIC_SHADOW_PAGE_CAPACITY;
          pageY++
        ) {
          for (
            let pageX = minimumPageX;
            pageX <= maximumPageX &&
            requestCount < DYNAMIC_SHADOW_PAGE_CAPACITY;
            pageX++
          ) {
            this.requestValues[requestCount] = encodeShadowPageKey(
              level,
              pageX,
              pageY,
            );
            requestCount++;
          }
        }
      }
    }

    this.counterValues[0] = requestCount;
    this.requestList.needsUpdate = true;
    this.counters.needsUpdate = true;
  }
}
