import {
  cos,
  hash,
  instanceIndex,
  mix,
  mrt,
  PI2,
  positionLocal,
  sin,
  texture,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { DoubleSide, MeshBasicNodeMaterial } from "three/webgpu";
import { assets, lighting, wind } from "../../systems";
import { gameTime } from "../../systems/time/gameTime";
import { config, uniforms } from "./pampasConfig";
import { type PampasCompute } from "./PampasCompute";

const { MIN_HEIGHT, MAX_HEIGHT, MIN_THICKNESS, MAX_THICKNESS, PLANT_HEIGHT } =
  config;

export class PampasMaterial extends MeshBasicNodeMaterial {
  constructor(pampasCompute: PampasCompute) {
    super();
    this.side = DoubleSide;
    this.forceSinglePass = true;

    const plantIndex = pampasCompute.visiblePlantIndices.element(instanceIndex);
    const plant = pampasCompute.plants.element(plantIndex);
    const heightHash = hash(plantIndex.add(9234));
    const thicknessHash = hash(plantIndex.add(4177));
    const facingHash = hash(plantIndex.add(577));
    const growth = plant.w;

    const height = mix(MIN_HEIGHT, MAX_HEIGHT, heightHash.mul(growth));
    const thickness = mix(MIN_THICKNESS, MAX_THICKNESS, thicknessHash);
    const facing = facingHash.mul(PI2);
    const turned = vec3(
      positionLocal.x.mul(cos(facing)).add(positionLocal.z.mul(sin(facing))),
      positionLocal.y,
      positionLocal.z.mul(cos(facing)).sub(positionLocal.x.mul(sin(facing))),
    );

    const plantBase = vec3(plant.x, plant.z, plant.y);
    const worldXZ = plantBase.xz.add(uniforms.uPlayerPosition.xz);
    const downwindDistance = worldXZ.dot(wind.uDirection);
    const swell = sin(
      downwindDistance.mul(0.3).sub(gameTime.mul(1.4)).add(heightHash.mul(2)),
    );
    const flutter = sin(
      gameTime.mul(3.1).add(facingHash.mul(PI2)).add(downwindDistance),
    );
    const ambientSway = swell.add(flutter.mul(0.3)).mul(uniforms.uAmbientSway);
    const gustLean = wind.uIntensityDirectional
      .mul(uniforms.uGustLean)
      .mul(swell.mul(0.25).add(1));
    const playerPush = pampasCompute.bends
      .element(plantIndex)
      .mul(uniforms.uPlayerPush);
    const flattening = playerPush.length().mul(-0.5);

    const heightRatio = positionLocal.y.div(PLANT_HEIGHT);
    const bend = heightRatio.mul(heightRatio);
    const lean = wind.uDirection.mul(ambientSway.add(gustLean)).add(playerPush);

    const flutterPhase = positionLocal
      .mul(vec3(5, 3, 5))
      .add(gameTime.mul(vec3(2.3, 1.7, 2.9)))
      .add(facingHash.mul(PI2));
    const plumeFlutter = sin(flutterPhase)
      .mul(vec3(1, 0.5, 1))
      .mul(uniforms.uFlutter)
      .mul(wind.uIntensityDirectional.add(1));

    this.positionNode = turned
      .add(vec3(lean.x, flattening, lean.y).add(plumeFlutter).mul(bend))
      .mul(vec3(thickness, height, thickness))
      .add(plantBase);

    const plume = texture(assets.resources.pampasDiffuse, uv());
    const tone = mix(0.85, 1.05, facingHash);
    const color = plume.rgb
      .mul(uniforms.uTint)
      .mul(tone)
      .mul(uniforms.uBrightness);
    this.colorNode = color;

    const hemiRadiance = lighting.uHemiSkyColor.rgb.add(
      lighting.uHemiGroundColor.rgb,
    );
    const ambientRadiance = hemiRadiance.mul(lighting.uHemiIntensity.mul(0.5));
    const sunRadiance = lighting.uSunRadiance.rgb;
    const totalRadiance = sunRadiance.add(ambientRadiance).max(0.0001);
    const directFraction = sunRadiance.div(totalRadiance);
    this.mrtNode = mrt({
      directSun: vec4(color.mul(directFraction), 1),
      softShadow: vec4(1),
    });

    this.opacityNode = plume.a;
    this.alphaTest = 0.15;
    this.alphaToCoverage = true;
  }
}
