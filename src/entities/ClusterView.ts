import {
  Box3,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LessEqualDepth,
  LineSegments,
  Mesh,
  Vector3,
  type Object3D,
} from "three";
import { LineBasicNodeMaterial, MeshBasicNodeMaterial } from "three/webgpu";
import { MeshoptClusterizer } from "meshoptimizer/clusterizer";
import { debugPanel, stage } from "../systems";
import { buildClusterMeshlets } from "../systems/vsm/VSMClusterBucket";

const CASTER_NAMES = ["goku_statue"];
const CLUSTER_COLORS = [
  0xe6194b, 0x3cb44b, 0xffe119, 0x4363d8, 0xf58231, 0x911eb4, 0x46f0f0,
  0xf032e6, 0xbcf60c, 0x9a6324,
];
// coprime with the palette size, so consecutive clusters land far apart in it
const CLUSTER_COLOR_STRIDE = 3;
const BOX_CORNERS = 8;
const VIEW_MODES = {
  Normal: "normal",
  Wireframe: "wireframe",
  Clusters: "clusters",
  "Cluster boxes": "boxes",
} as const;

type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES];

const getClusterColor = (cluster: number, color: Color) => {
  const colorIndex = (cluster * CLUSTER_COLOR_STRIDE) % CLUSTER_COLORS.length;
  return color.setHex(CLUSTER_COLORS[colorIndex]);
};

const createClusterGeometry = (geometry: BufferGeometry) => {
  const position = geometry.getAttribute("position");
  const { index } = geometry;
  let count = position.count;
  if (index) count = index.count;
  const meshlets = buildClusterMeshlets(geometry, { start: 0, count });
  const positions: number[] = [];
  const colors: number[] = [];
  const boxes: Box3[] = [];
  const color = new Color();
  const vertex = new Vector3();
  for (let cluster = 0; cluster < meshlets.meshletCount; cluster++) {
    const { vertices, triangles } = MeshoptClusterizer.extractMeshlet(
      meshlets,
      cluster,
    );
    const box = new Box3();
    getClusterColor(cluster, color);
    for (const meshletVertex of triangles) {
      const vertexIndex = vertices[meshletVertex];
      vertex.fromBufferAttribute(position, vertexIndex);
      box.expandByPoint(vertex);
      positions.push(vertex.x, vertex.y, vertex.z);
      colors.push(color.r, color.g, color.b);
    }
    boxes.push(box);
  }
  const clusterGeometry = new BufferGeometry();
  clusterGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  clusterGeometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return { clusterGeometry, boxes };
};

const pushBoxCorner = (box: Box3, corner: number, positions: number[]) => {
  const { min, max } = box;
  const x = corner & 1 ? max.x : min.x;
  const y = corner & 2 ? max.y : min.y;
  const z = corner & 4 ? max.z : min.z;
  positions.push(x, y, z);
};

const appendBoxEdges = (
  box: Box3,
  color: Color,
  positions: number[],
  colors: number[],
) => {
  // an edge joins two corners whose ids differ by a single axis bit
  for (let corner = 0; corner < BOX_CORNERS; corner++)
    for (let axis = 1; axis < BOX_CORNERS; axis <<= 1) {
      if (corner & axis) continue;
      pushBoxCorner(box, corner, positions);
      pushBoxCorner(box, corner | axis, positions);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
};

const createBoxesGeometry = (boxes: Box3[]) => {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new Color();
  for (let cluster = 0; cluster < boxes.length; cluster++)
    appendBoxEdges(
      boxes[cluster],
      getClusterColor(cluster, color),
      positions,
      colors,
    );
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
};

const getSceneMesh = (name: string) => {
  const object = stage.mainScene.getObjectByName(name);
  if (!(object instanceof Mesh)) throw new Error(`Scene has no mesh "${name}"`);
  return object;
};

const addOverlay = <T extends Object3D>(mesh: Mesh, overlay: T) => {
  overlay.matrixAutoUpdate = false;
  overlay.matrix.copy(mesh.matrixWorld);
  overlay.visible = false;
  stage.mainScene.add(overlay);
  return overlay;
};

class CasterView {
  private readonly mesh: Mesh;
  private readonly wireframe: Mesh;
  private readonly clusters: Mesh;
  private readonly boxes: LineSegments;

  constructor(mesh: Mesh) {
    this.mesh = mesh;
    mesh.updateWorldMatrix(true, false);
    const wireframeMaterial = new MeshBasicNodeMaterial({
      color: 0xffffff,
      wireframe: true,
      depthFunc: LessEqualDepth,
    });
    this.wireframe = addOverlay(
      mesh,
      new Mesh(mesh.geometry, wireframeMaterial),
    );
    const clusterMaterial = new MeshBasicNodeMaterial({ vertexColors: true });
    const { clusterGeometry, boxes } = createClusterGeometry(mesh.geometry);
    this.clusters = addOverlay(
      mesh,
      new Mesh(clusterGeometry, clusterMaterial),
    );
    const boxesMaterial = new LineBasicNodeMaterial({ vertexColors: true });
    const boxesGeometry = createBoxesGeometry(boxes);
    this.boxes = addOverlay(
      mesh,
      new LineSegments(boxesGeometry, boxesMaterial),
    );
  }

  setMode(mode: ViewMode) {
    this.mesh.visible = mode === "normal" || mode === "wireframe";
    this.wireframe.visible = mode === "wireframe" || mode === "clusters";
    this.clusters.visible = mode === "clusters" || mode === "boxes";
    this.boxes.visible = mode === "boxes";
  }
}

export class ClusterView {
  private readonly settings: { mode: ViewMode } = { mode: "normal" };
  private readonly views = CASTER_NAMES.map(
    (name) => new CasterView(getSceneMesh(name)),
  );

  constructor() {
    const folder = debugPanel.panel.addFolder({
      title: "🧩 Caster triangles",
      expanded: false,
    });
    folder
      .addBinding(this.settings, "mode", {
        label: "Goku statue",
        options: VIEW_MODES,
      })
      .on("change", ({ value }) => {
        for (const view of this.views) view.setMode(value);
      });
  }
}
