import { InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import { ColliderDesc } from "@dimforge/rapier3d";
import {
  assets,
  debugPanel,
  eventBus,
  physicsWorld,
  stage,
  graphics,
  wind,
} from "../../systems";
import { VSMReceiverLambertMaterial } from "../../systems/vsm/VSMReceiverMaterials";
import {
  Fn,
  attribute,
  float,
  normalMap,
  oscSine,
  positionGeometry,
  positionLocal,
  sin,
  texture,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { RevoColliderType } from "../../systems/physics/colliderTypes";
import { gameTime } from "../../systems/time/gameTime";
import { PineTreesCompute } from "./PineTreesCompute";
import type { ComputeTask } from "../../systems/rendering/ComputeTask";

// neighbouring pines sway slightly out of step, so the motion rolls through
// the forest along the wind instead of every tree rocking in unison
const SWAY_PHASE_PER_METER = 0.02;

const uniforms = {
  uCanopyDiffuseScale: uniform(0.6),
  uCanopySwaySpeed: uniform(0.6),
  uBarkDiffuseScale: uniform(3.5),
  uBarkNormalScale: uniform(3),
  uBarkUvScale: uniform(3),
  uTrunkSwaySpeed: uniform(0.35),
  uTrunkSway: uniform(0.14),
  uGustLean: uniform(0.55),
};

// the whole pine bends from its roots, so bark and canopy move together and
// the crown travels the most
const computeTrunkBend = Fn<[crownHeight: Node<"float">], Node<"vec3">>(
  ([crownHeight]) => {
    const windDirection = vec3(wind.uDirection.x, 0, wind.uDirection.y);
    const crossWindDirection = vec3(
      wind.uDirection.y.negate(),
      0,
      wind.uDirection.x,
    );
    const windTravel = positionLocal.xz
      .dot(wind.uDirection)
      .mul(SWAY_PHASE_PER_METER);
    const phase = gameTime.mul(uniforms.uTrunkSwaySpeed).sub(windTravel);

    const alongWindSway = windDirection.mul(sin(phase));
    const crossWindSway = crossWindDirection.mul(
      sin(phase.mul(0.7).add(1.7)).mul(0.5),
    );
    const ambientSway = alongWindSway
      .add(crossWindSway)
      .mul(uniforms.uTrunkSway);

    const gustPulse = sin(phase.mul(2)).mul(0.3).add(0.7);
    const gustLean = windDirection.mul(
      wind.uIntensityDirectional.mul(uniforms.uGustLean).mul(gustPulse),
    );

    const heightRatio = positionGeometry.y.div(crownHeight);
    return ambientSway.add(gustLean).mul(heightRatio.mul(heightRatio));
  },
);

class PineTreeCanopyMaterial extends VSMReceiverLambertMaterial {
  constructor(crownHeight: number) {
    super();
    this.forceSinglePass = true;

    const windWeight = attribute<"float">("_windweight");

    const diffuse = texture(assets.resources.pineCanopyDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.uCanopyDiffuseScale);
    this.opacityNode = diffuse.a;
    this.alphaTest = 0.35;
    this.alphaToCoverage = true;
    // needles are too thin and noisy for the finest shadow pages, and close up
    // they scatter page requests across the whole pool
    this.softShadowNode = float(0.5);

    const random = uv().x.mul(uv().y).mul(4);
    const profile = windWeight.mul(windWeight);
    const t = gameTime.mul(uniforms.uCanopySwaySpeed).add(random);
    const gustBoost = wind.uIntensityDirectional.add(1);
    const swayOffset = oscSine(t).mul(profile).mul(0.075).mul(gustBoost);
    this.positionNode = positionLocal
      .add(computeTrunkBend(float(crownHeight)))
      .add(vec3(0, swayOffset, 0));
  }
}

class PineTreeBarkMaterial extends VSMReceiverLambertMaterial {
  constructor(crownHeight: number) {
    super();
    this.forceSinglePass = true;
    const _uv = uv().mul(uniforms.uBarkUvScale);
    const diffuse = texture(assets.resources.pineBarkDiffuse, _uv);
    this.colorNode = diffuse.rgb.mul(uniforms.uBarkDiffuseScale);

    const normal = texture(assets.resources.pineBarkNormal, _uv);
    this.normalNode = normalMap(normal, uniforms.uBarkNormalScale);

    this.positionNode = positionLocal.add(computeTrunkBend(float(crownHeight)));
  }
}

export class PineTrees {
  private compute: PineTreesCompute;
  private computeTask: ComputeTask;

  constructor() {
    const { pineModel, pinesPlacements } = assets.resources;
    const canopy = assets.getMesh("pine-canopy", pineModel);
    const bark = assets.getMesh("pine-bark", pineModel);
    const collider = assets.getObject("pine-capsule-collider", pineModel);
    // the terrain scatter writes one 4x4 matrix per pine
    const { buffer, byteOffset, byteLength } = pinesPlacements;
    const matrices = new Float32Array(buffer, byteOffset, byteLength / 4);

    this.compute = new PineTreesCompute(matrices, [
      bark.geometry,
      canopy.geometry,
    ]);
    this.computeTask = graphics.createComputeTask({
      label: "Pine trees",
      update: [
        this.compute.computeResetInstanceCounts,
        this.compute.computeCull,
      ],
    });

    canopy.geometry.computeBoundingBox();
    const canopyBounds = canopy.geometry.boundingBox;
    if (!canopyBounds) throw new Error("Pine canopy has no bounding box");
    const crownHeight = canopyBounds.max.y;

    const barkMesh = this.createInstancedMesh(
      bark,
      new PineTreeBarkMaterial(crownHeight),
      0,
    );
    const canopyMesh = this.createInstancedMesh(
      canopy,
      new PineTreeCanopyMaterial(crownHeight),
      1,
    );
    stage.mainScene.add(barkMesh, canopyMesh);
    graphics.vsmPass.registerCaster(barkMesh);
    graphics.vsmPass.registerCaster(canopyMesh, {
      opacityNode: texture(assets.resources.pineCanopyDiffuse).a,
    });

    for (let index = 0; index < matrices.length / 16; index++) {
      this.createCollider(collider.matrix, matrices, index);
    }

    eventBus.on("engine-render-update", this.onEngineUpdate);
    this.debug();
  }

  private onEngineUpdate = () => {
    this.computeTask.update();
  };

  private createInstancedMesh(
    part: Mesh,
    material: PineTreeBarkMaterial | PineTreeCanopyMaterial,
    draw: number,
  ) {
    const { geometry } = part;
    const mesh = new InstancedMesh(geometry, material, 0);
    mesh.instanceMatrix = this.compute.visibleMatrices;
    mesh.count = this.compute.visibleMatrices.count;
    mesh.frustumCulled = false;
    geometry.setIndirect(
      this.compute.drawArgumentsAttribute,
      this.compute.getDrawArgumentsOffset(draw),
    );
    return mesh;
  }

  // the collider is a unit capsule sized by its scale, diameter in x and height in y
  private createCollider(
    colliderMatrix: Matrix4,
    matrices: Float32Array,
    index: number,
  ) {
    const position = new Vector3();
    const quaternion = new Quaternion();
    const size = new Vector3();
    new Matrix4()
      .fromArray(matrices, index * 16)
      .multiply(colliderMatrix)
      .decompose(position, quaternion, size);
    const radius = size.x / 2;
    const colliderDesc = ColliderDesc.capsule(size.y / 2 - radius, radius)
      .setTranslation(...position.toArray())
      .setRotation(quaternion)
      .setRestitution(0.5);
    physicsWorld.world.createCollider(colliderDesc).userData = {
      type: RevoColliderType.Wood,
    };
  }

  private debug() {
    const folder = debugPanel.panel.addFolder({
      title: "🌲 Pine Trees",
      expanded: false,
    });
    const canopy = folder.addFolder({
      title: "Canopy",
    });
    canopy.addBinding(uniforms.uCanopyDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
    canopy.addBinding(uniforms.uCanopySwaySpeed, "value", {
      label: "Sway speed",
      min: 0,
    });

    const bark = folder.addFolder({
      title: "Bark",
    });

    bark.addBinding(uniforms.uBarkUvScale, "value", {
      label: "UV scale",
      min: 0,
    });
    bark.addBinding(uniforms.uBarkDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
    bark.addBinding(uniforms.uBarkNormalScale, "value", {
      label: "Normal scale",
      min: 0,
    });

    const trunk = folder.addFolder({
      title: "Trunk",
    });
    trunk.addBinding(uniforms.uTrunkSwaySpeed, "value", {
      label: "Sway speed",
      min: 0,
    });
    trunk.addBinding(uniforms.uTrunkSway, "value", {
      label: "Sway",
      min: 0,
    });
    trunk.addBinding(uniforms.uGustLean, "value", {
      label: "Gust lean",
      min: 0,
    });
  }
}
