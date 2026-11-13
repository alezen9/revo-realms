import { AdditiveBlending, DoubleSide } from "three";
import {
  cameraPosition,
  float,
  instanceIndex,
  mix,
  smoothstep,
  step,
  uv,
  vec3,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { wind } from "../../systems";
import { config, uniforms } from "./WindStreaksConfig";
import type { WindStreaksCompute } from "./WindStreaksCompute";

const { SPINE_POINT_COUNT, SEGMENT_COUNT } = config;

export class WindStreaksMaterial extends MeshBasicNodeMaterial {
  constructor(streaksCompute: WindStreaksCompute) {
    super();

    this.transparent = true;
    this.blending = AdditiveBlending;
    this.depthWrite = false;
    this.forceSinglePass = true;
    this.side = DoubleSide;

    const streakIndex = float(instanceIndex);
    const baseIndex = streakIndex.mul(SPINE_POINT_COUNT);
    const trailProgress = uv().y;
    const row = trailProgress.mul(SEGMENT_COUNT).round();
    const headRow = row.sub(1).max(0);
    const tailRow = row.add(1).min(SEGMENT_COUNT);
    const { spinePoints } = streaksCompute;
    const point = spinePoints.element(baseIndex.add(row));
    const towardHead = spinePoints.element(baseIndex.add(headRow)).xyz;
    const towardTail = spinePoints.element(baseIndex.add(tailRow)).xyz;

    const windDirection = vec3(wind.uDirection.x, 0, wind.uDirection.y);
    const endpointDirection = windDirection.mul(-0.001);
    const incoming = point.xyz
      .sub(towardHead)
      .add(endpointDirection)
      .normalize();
    const outgoing = towardTail
      .sub(point.xyz)
      .add(endpointDirection)
      .normalize();
    const tangent = incoming.add(outgoing).normalize();
    const toCamera = cameraPosition.sub(point.xyz);
    const viewDirection = toCamera.div(toCamera.length().max(1e-5));
    const cameraSide = tangent.cross(viewDirection);
    const cameraSideLength = cameraSide.length();
    const cameraSideAxis = cameraSide.div(cameraSideLength.max(1e-5));
    const worldSide = tangent.cross(vec3(0, 1, 0)).normalize();
    const isFacingWorldSide = step(0, cameraSide.dot(worldSide));
    const alignedWorldSide = mix(
      worldSide.negate(),
      worldSide,
      isFacingWorldSide,
    );
    const sideBlend = smoothstep(0.05, 0.2, cameraSideLength);
    const sideAxis = mix(
      alignedWorldSide,
      cameraSideAxis,
      sideBlend,
    ).normalize();
    const miterCosine = tangent.dot(outgoing).abs().max(1e-3);
    const miterScale = float(1).div(miterCosine).min(1.5);
    const sideSign = uv().x.mul(2).sub(1);
    const headTaper = smoothstep(0, 0.2, trailProgress);
    const tailTaper = float(1).sub(trailProgress).pow(1.5);
    const width = uniforms.uWidth.mul(headTaper).mul(tailTaper).mul(miterScale);
    const sideOffset = sideAxis.mul(sideSign).mul(width);

    this.positionNode = point.xyz.add(sideOffset);
    this.colorNode = uniforms.uColor;

    const edgeFade = float(1).sub(smoothstep(0.08, 0.92, sideSign.abs()));
    const trailFade = float(1).sub(smoothstep(0.1, 1, trailProgress));
    const headFade = mix(0.4, 1, trailFade);
    this.opacityNode = point.w.mul(0.09).mul(edgeFade).mul(headFade);
  }
}
