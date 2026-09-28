import {
  Fn,
  TWO_PI,
  cos,
  float,
  hash,
  max,
  min,
  mix,
  sin,
  smoothstep,
  texture,
  vec2,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { assets, wind } from "../../systems";
import { gameDeltaTime, gameTime } from "../../systems/time/gameTime";
import { uniforms } from "./config";

// cubic bezier with P0 = 0 and P3 = 1 over normalized blade height
const computeWindResponse = Fn<[bladeScale: Node<"float">], Node<"float">>(
  ([bladeScale]) => {
    const t = bladeScale.div(uniforms.uBladeMaxScale).clamp();

    const linear = uniforms.uWindCurveP1.mul(3);

    const quadratic = uniforms.uWindCurveP2
      .mul(3)
      .sub(uniforms.uWindCurveP1.mul(6));

    const cubic = uniforms.uWindCurveP1
      .mul(3)
      .sub(uniforms.uWindCurveP2.mul(3))
      .add(1);

    return t.mul(linear.add(t.mul(quadratic.add(t.mul(cubic)))));
  },
);

export const computeDetailedWind = Fn<
  [
    previousWindXZ: Node<"vec2">,
    worldPos: Node<"vec3">,
    positionNoise: Node<"float">,
    resetWind: Node<"float">,
  ],
  Node<"vec3">
>(([previousWindXZ, worldPos, positionNoise, resetWind]) => {
  const windDirection = wind.uDirection;
  const windEventIntensity = wind.uIntensityDirectional;

  const perpendicularDirection = vec2(
    windDirection.y.negate(),
    windDirection.x,
  );

  const noiseScrollDirection = perpendicularDirection
    .mul(0.3717)
    .sub(windDirection);

  const windNoiseUv = worldPos.xz
    .mul(uniforms.uWindUvScale.mul(0.01))
    .add(noiseScrollDirection.mul(uniforms.uWindSpeed.mul(gameTime)));

  const windNoise = texture(assets.resources.noiseAtlas, windNoiseUv);

  const fastGust = sin(windNoise.g.mul(18.85)).mul(0.5).add(0.5);

  const gustField = mix(windNoise.r, fastGust, windEventIntensity);

  const gustThreshold = float(1).sub(uniforms.uWindGustCoverage);

  const gust = smoothstep(gustThreshold, gustThreshold.add(0.25), gustField);

  const windStrength = uniforms.uWindStrength
    .mul(mix(uniforms.uWindLull, 1, gust))
    .mul(mix(1, 4, windEventIntensity));

  const directionalVeer = windNoise.g
    .sub(0.5)
    .mul(2)
    .mul(uniforms.uWindEddyStrength);

  const targetDirection = windDirection.add(
    perpendicularDirection.mul(directionalVeer),
  );

  const targetWindXZ = targetDirection.mul(windStrength);

  const responseRate = mix(3.5, 11, positionNoise).mul(mix(0.3, 1, gust));

  const responseFactor = min(responseRate.mul(gameDeltaTime), 1);

  const windDelta = targetWindXZ.sub(previousWindXZ);

  const smoothedWindXZ = previousWindXZ.add(windDelta.mul(responseFactor));

  const nextWindXZ = mix(smoothedWindXZ, targetWindXZ, resetWind);

  return vec3(nextWindXZ, gust);
});

export const computeBladeDeformation = Fn<
  [
    windXZ: Node<"vec2">,
    gust: Node<"float">,
    worldPos: Node<"vec3">,
    scaleY: Node<"float">,
    bladeIndex: Node<"uint">,
  ],
  Node<"vec2">
>(([windXZ, gust, worldPos, scaleY, bladeIndex]) => {
  const bladeSeed = hash(bladeIndex);
  const randomPhase = bladeSeed.mul(6.2825).sub(3.14125);
  const swayRateNoise = bladeSeed.mul(31.7).fract();

  const scaleWindResponse = computeWindResponse(scaleY);

  const windIntensity = windXZ.dot(windXZ).mul(3.5).clamp();

  const gustInfluence = smoothstep(0.2, 1, gust);

  const windActivity = max(windIntensity, gustInfluence.mul(0.45));

  const swayEnvelope = mix(0.75, 1.35, windActivity);
  const heightPhase = swayEnvelope.mul(0.55);
  const swayRate = mix(0.7, 1.45, swayRateNoise);

  const swayAPhase = gameTime
    .mul(swayRate.mul(1.35))
    .add(randomPhase)
    .add(heightPhase);

  const swayA = sin(swayAPhase);

  const swayBPhase = gameTime
    .mul(swayRate.mul(2.15))
    .add(worldPos.x.mul(0.17))
    .add(worldPos.z.mul(0.11))
    .add(randomPhase.mul(1.7))
    .add(heightPhase.mul(1.6));

  const swayB = sin(swayBPhase).mul(0.45);

  const ambientAngle = bladeSeed.mul(53.3).fract().mul(TWO_PI);

  const ambientDirection = vec2(cos(ambientAngle), sin(ambientAngle));

  const ambientStrength = swayA
    .add(swayB)
    .mul(uniforms.uAmbientSwayStrength)
    .mul(swayEnvelope);

  const ambientOffset = ambientDirection.mul(ambientStrength);

  const perpendicularDirection = vec2(
    wind.uDirection.y.negate(),
    wind.uDirection.x,
  );

  const bendStrength = uniforms.uBaseBending.mul(scaleWindResponse);

  const flutterPhase = bladeSeed
    .mul(97.13)
    .fract()
    .mul(TWO_PI)
    .add(worldPos.x.mul(0.13))
    .add(worldPos.z.mul(0.07));

  const flutterTime = gameTime.mul(uniforms.uWindSpeed.mul(1.7));

  const flutter = sin(
    flutterTime.add(flutterPhase.mul(1.3)).add(heightPhase.mul(2.2)),
  )
    .mul(0.025)
    .mul(windActivity)
    .mul(bendStrength);

  const windBend = windXZ.mul(bendStrength);
  const ambientBend = ambientOffset.mul(scaleWindResponse);
  const flutterBend = perpendicularDirection.mul(flutter);

  return windBend.add(ambientBend).add(flutterBend);
});

export const computeDistantWind = Fn<[worldPos: Node<"vec3">], Node<"vec3">>(
  ([worldPos]) => {
    const windDirection = wind.uDirection;
    const windEventIntensity = wind.uIntensityDirectional;

    const spatialPhase = worldPos.x.mul(0.035).add(worldPos.z.mul(0.025));

    const temporalPhase = gameTime.mul(uniforms.uWindSpeed.mul(2.2));

    const phase = spatialPhase.add(temporalPhase);
    const wave = sin(phase);
    const gust = wave.mul(0.5).add(0.5);

    const windStrength = uniforms.uWindStrength
      .mul(mix(uniforms.uWindLull, 1, gust))
      .mul(mix(1, 4, windEventIntensity));

    return vec3(windDirection.mul(windStrength), gust);
  },
);

export const computeDistantBladeDeformation = Fn<
  [
    windXZ: Node<"vec2">,
    gust: Node<"float">,
    scaleY: Node<"float">,
    bladeIndex: Node<"uint">,
  ],
  Node<"vec2">
>(([windXZ, gust, scaleY, bladeIndex]) => {
  const scaleWindResponse = computeWindResponse(scaleY);

  const perpendicularDirection = vec2(
    wind.uDirection.y.negate(),
    wind.uDirection.x,
  );

  const bladeSeed = hash(bladeIndex.add(613));
  const strengthVariation = mix(0.88, 1.12, bladeSeed);

  const flutterPhase = bladeSeed.mul(97.13).fract().mul(TWO_PI);

  const flutterTime = gameTime.mul(uniforms.uWindSpeed.mul(1.4));

  const flutter = sin(flutterTime.add(flutterPhase)).mul(
    uniforms.uAmbientSwayStrength.mul(0.2),
  );

  const broadSway = gust
    .sub(0.5)
    .mul(uniforms.uAmbientSwayStrength.mul(0.7))
    .add(flutter);

  const bendStrength = uniforms.uBaseBending
    .mul(scaleWindResponse)
    .mul(strengthVariation);

  const windBend = windXZ.mul(bendStrength);

  const broadSwayBend = perpendicularDirection.mul(
    broadSway.mul(scaleWindResponse),
  );

  return windBend.add(broadSwayBend);
});
