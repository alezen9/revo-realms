import {
  float,
  hash,
  instanceIndex,
  mix,
  mrt,
  PI2,
  positionLocal,
  sin,
  smoothstep,
  texture,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { MeshBasicNodeMaterial, type Node } from "three/webgpu";
import { assets, lighting, wind } from "../../systems";
import { gameTime } from "../../systems/time/gameTime";
import { uniforms } from "./config";
import {
  type FlowersCompute,
  getGrassScale,
  getNoise,
  getYOffset,
} from "./FlowersCompute";

const getFlowerLocalPosition = (
  flowersCompute: FlowersCompute,
  flowerIndex: Node<"uint">,
  sourcePosition: Node<"vec3">,
) => {
  const data = flowersCompute.flowers.element(flowerIndex);
  const grassScale = getGrassScale(data);
  const noise = getNoise(data);
  const x = data.x;
  const y = getYOffset(data);
  const z = data.y;
  const rand1 = hash(flowerIndex.add(9234));
  const rand2 = hash(flowerIndex.add(33.87));
  const rand3 = hash(float(flowerIndex).add(noise.r.mul(97.13)));
  const scale = rand1
    .remap(0, 1, uniforms.uMinScale, uniforms.uMaxScale)
    .mul(grassScale);
  const windDirection = wind.uDirection;
  const windEvent = wind.uIntensityDirectional;
  const timer = gameTime.mul(uniforms.uWindSwaySpeed);
  const windTravel = x.mul(windDirection.x).add(z.mul(windDirection.y));
  const travelWave = sin(
    windTravel.mul(0.16).sub(timer.mul(2.2)).add(rand3.mul(PI2)),
  )
    .mul(0.5)
    .add(0.5);
  const directionalWave = smoothstep(0.28, 0.88, travelWave);
  const responseVariation = mix(0.55, 1.15, noise.g).mul(
    mix(0.72, 1.05, rand1),
  );
  const ambientPhase = timer.add(rand1.mul(100)).add(noise.b.mul(12));
  const ambientSway = uniforms.uWindAmbientStrength
    .mul(mix(0.45, 1, noise.a))
    .mul(grassScale);
  const directionalSway = uniforms.uWindDirectionalStrength
    .mul(windEvent)
    .mul(directionalWave)
    .mul(responseVariation)
    .mul(grassScale);
  const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
  const sideSway = sin(ambientPhase.mul(1.35))
    .mul(ambientSway)
    .mul(mix(0.12, 0.42, rand2));
  const windLean = windDirection.mul(directionalSway);
  const ambientLean = windDirection
    .mul(sin(ambientPhase).mul(ambientSway))
    .add(sideDirection.mul(sideSway));
  const swayOffset = vec3(
    ambientLean.x.add(windLean.x),
    rand2
      .mul(0.28)
      .add(
        sin(ambientPhase.mul(1.7).add(rand3.mul(PI2))).mul(
          uniforms.uWindVerticalBobStrength.mul(grassScale),
        ),
      ),
    ambientLean.y.add(windLean.y),
  );
  const baseHeight = rand1.add(rand2).add(0.25).clamp().mul(grassScale);
  return sourcePosition
    .mul(scale)
    .add(vec3(x, y.add(baseHeight), z))
    .add(swayOffset);
};

export class FlowerMaterial extends MeshBasicNodeMaterial {
  constructor(flowersCompute: FlowersCompute) {
    super();
    this.stencilWrite = false;
    this.forceSinglePass = true;
    this.transparent = false;

    const flowerIndex =
      flowersCompute.visibleFlowerIndices.element(instanceIndex);
    const rand2 = hash(flowerIndex.add(33.87));
    this.positionNode = getFlowerLocalPosition(
      flowersCompute,
      flowerIndex,
      positionLocal,
    );

    const flower = texture(assets.resources.edelweiss, uv());
    const tint = mix(uniforms.uColor1, uniforms.uColor2, rand2);
    const flowerColor = tint.mul(flower.rgb).mul(uniforms.uBrightness);
    this.colorNode = flowerColor;
    const ambientRadiance = lighting.uHemiSkyColor.rgb
      .add(lighting.uHemiGroundColor.rgb)
      .mul(lighting.uHemiIntensity.mul(0.5));
    const sunRadiance = lighting.uSunRadiance.rgb;
    const directFraction = sunRadiance.div(
      sunRadiance.add(ambientRadiance).max(0.0001),
    );
    this.mrtNode = mrt({
      directSun: vec4(flowerColor.mul(directFraction), 1),
      softShadow: vec4(1),
    });

    this.opacityNode = flower.a;
    this.alphaTest = 0.15;
    this.alphaToCoverage = true;
  }
}
