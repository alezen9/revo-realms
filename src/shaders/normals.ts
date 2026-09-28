import { Fn, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";

type Vec3Node = Node<"vec3">;

// inputs are tangent space normals already unpacked to -1..1 and normalized
export const blendRNM = Fn<[n1: Vec3Node, n2: Vec3Node], Vec3Node>(([n1, n2]) =>
  vec3(
    n1.z.mul(n2.x).add(n1.x.mul(n2.z)),
    n1.z.mul(n2.y).add(n1.y.mul(n2.z)),
    n1.z.mul(n2.z).sub(n1.x.mul(n2.x).add(n1.y.mul(n2.y))),
  ).normalize(),
);
