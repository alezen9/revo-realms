import type Node from "three/src/nodes/core/Node.js";

declare module "three/src/nodes/gpgpu/WorkgroupInfoNode.js" {
  export default interface WorkgroupInfoNode {
    element<TNodeType extends string>(
      indexNode: Node<"uint"> | number,
    ): Node<TNodeType>;
  }
}
