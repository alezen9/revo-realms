import type { Object3D } from "three";
import { assets } from "../../systems";

// landmarks sit at the origin of their own model, terrain.glb holds where each one stands
export const placeAtAnchor = (name: string, objects: Object3D[]) => {
  const anchor = assets.getObject(name, assets.resources.terrainModel);
  anchor.updateWorldMatrix(true, false);
  for (const object of objects) object.applyMatrix4(anchor.matrixWorld);
};
