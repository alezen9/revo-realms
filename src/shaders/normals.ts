import { Fn, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";

type Vec3Node = Node<"vec3">;

// inputs are tangent space normals already unpacked to -1..1 and normalized
export const blendRNM = Fn<[n1: Vec3Node, n2: Vec3Node], Vec3Node>(
  ([n1, n2]) => {
    const blendedX = n1.z.mul(n2.x).add(n1.x.mul(n2.z));
    const blendedY = n1.z.mul(n2.y).add(n1.y.mul(n2.z));
    const tangentDot = n1.xy.dot(n2.xy);
    const blendedZ = n1.z.mul(n2.z).sub(tangentDot);
    return vec3(blendedX, blendedY, blendedZ).normalize();
  },
);
