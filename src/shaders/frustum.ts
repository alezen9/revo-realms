import { EPSILON, Fn, float, step } from "three/tsl";
import type { Node } from "three/webgpu";

type FloatNode = Node<"float">;

type FrustumVisibilityArgs = [
  clipPosition: Node<"vec4">,
  fX: FloatNode,
  fY: FloatNode,
  radius: FloatNode,
  padNdcX: FloatNode,
  padNdcYNear: FloatNode,
  padNdcYFar: FloatNode,
];

export const computeFrustumVisibility = Fn<FrustumVisibilityArgs, FloatNode>(
  ([clipPosition, fX, fY, radius, padNdcX, padNdcYNear, padNdcYFar]) => {
    const one = float(1);
    const ndc = clipPosition.xyz.mul(one.div(clipPosition.w));
    const eyeDepthAbs = clipPosition.w.abs().max(EPSILON);
    const radiusNdcX = fX.mul(radius).div(eyeDepthAbs).add(padNdcX);
    const radiusNdcY = fY.mul(radius).div(eyeDepthAbs);
    const radiusNdcYNear = radiusNdcY.add(padNdcYNear);
    const radiusNdcYFar = radiusNdcY.sub(padNdcYFar);
    const isVisibleX = step(one.negate().sub(radiusNdcX), ndc.x).mul(
      step(ndc.x, one.add(radiusNdcX)),
    );
    const isVisibleY = step(one.negate().sub(radiusNdcYNear), ndc.y).mul(
      step(ndc.y.add(radiusNdcYFar), one),
    );
    const isVisibleZ = step(-1, ndc.z).mul(step(ndc.z, 1));
    return isVisibleX.mul(isVisibleY).mul(isVisibleZ);
  },
);
