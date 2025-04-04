import { Mesh, PlaneGeometry, Vector2, Vector3 } from "three";
import { sceneManager } from "../systems/SceneManager";
import {
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  NormalMapNode,
} from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import {
  cameraPosition,
  context,
  cubeTexture,
  float,
  fract,
  mix,
  normalize,
  positionViewDirection,
  positionWorld,
  reflect,
  reflectVector,
  rotateUV,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { State } from "../Game";
import { eventsManager } from "../systems/EventsManager";
import ripplesMaskUrl from "/textures/realm/ripplesMask.webp?url";

const getConfig = () => {
  const CANVAS_SIZE = 128;
  const RIPPLES_SIZE = 32;
  const AREA_SIZE = 50;
  return {
    CANVAS_SIZE,
    CANVAS_HALF_SIZE: CANVAS_SIZE / 2,
    RIPPLES_SIZE,
    RIPPLES_HALF_SIZE: RIPPLES_SIZE / 2,
    AREA_SIZE,
    AREA_HALF_SIZE: AREA_SIZE / 2,
  };
};

const config = getConfig();

export default class Ripples {
  private playerPos = new Vector2(0, 0);
  private delta = new Vector2(0, 0);

  constructor() {
    const geom = new PlaneGeometry(10, 10);
    geom.rotateX(-Math.PI / 2);
    const mat = new RipplesMaterial();
    const mesh = new Mesh(geom, mat);

    sceneManager.scene.add(mesh);

    const rippleImage = new Image();
    rippleImage.src = ripplesMaskUrl;
    const canvas = this.createCanvas();
    const bufferCanvas = document.createElement("canvas");
    bufferCanvas.width = config.CANVAS_SIZE;
    bufferCanvas.height = config.CANVAS_SIZE;

    eventsManager.on("update", ({ player }) => {
      mesh.position.copy(player.position).setY(0.1);
    });

    eventsManager.on("update-throttled-30", ({ player }) => {
      const x = (player.position.x + config.AREA_HALF_SIZE) / config.AREA_SIZE;
      const z = (player.position.z + config.AREA_HALF_SIZE) / config.AREA_SIZE;

      // Now x, z are in [0, 1] → multiply by canvas size to get pixel coords
      const px = x * config.CANVAS_SIZE - config.RIPPLES_HALF_SIZE;
      const py = z * config.CANVAS_SIZE - config.RIPPLES_HALF_SIZE;

      const dx = px - this.playerPos.x;
      const dy = py - this.playerPos.y;

      this.delta.set(dx, dy);

      // Center the ripple image
      this.playerPos.set(px, py);

      // if (Math.abs(dx) < 0.5 || Math.abs(dy) < 0.5) return;
      this.drawRipples(canvas, bufferCanvas, rippleImage);
    });
  }

  private createCanvas() {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas); // only for debugging
    canvas.width = config.CANVAS_SIZE;
    canvas.height = config.CANVAS_SIZE;

    canvas.style.position = "fixed";
    canvas.style.width = "512px";
    canvas.style.height = "512px";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.zIndex = "10";

    return canvas;
  }

  private drawRipples(
    canvas: HTMLCanvasElement,
    bufferCanvas: HTMLCanvasElement,
    image: HTMLImageElement,
  ) {
    const ctx = canvas.getContext("2d");
    const buffer = bufferCanvas.getContext("2d");
    if (!ctx || !buffer) return;

    const w = config.CANVAS_SIZE;
    const h = config.CANVAS_SIZE;

    // Clear main canvas
    ctx.clearRect(0, 0, w, h);

    // Draw faded + shifted + scaled previous frame
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.translate(-this.delta.x, -this.delta.y); // shift previous image
    ctx.translate(w / 2, h / 2); // center for scaling
    ctx.scale(1.05, 1.05); // expand ripples slightly
    ctx.translate(-w / 2, -h / 2); // back from center
    ctx.drawImage(bufferCanvas, 0, 0);
    ctx.restore();

    // Draw new ripple at center
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "lighten";
    ctx.drawImage(
      image,
      config.CANVAS_HALF_SIZE - config.RIPPLES_HALF_SIZE,
      config.CANVAS_HALF_SIZE - config.RIPPLES_HALF_SIZE,
      config.RIPPLES_SIZE,
      config.RIPPLES_SIZE,
    );

    // Save current frame into buffer
    buffer.clearRect(0, 0, w, h);
    buffer.drawImage(canvas, 0, 0);
  }
}

class RipplesMaterial extends MeshBasicNodeMaterial {
  private uPlayerPos = uniform(new Vector3(0, 0, 0));
  private uTime = uniform(0);

  constructor() {
    super();

    this.createMaterial();

    eventsManager.on("update", this.update.bind(this));
  }

  private update(state: State) {
    const { clock } = state;
    this.uTime.value = clock.getElapsedTime();
    // this.uPlayerPos.value.copy(player.position);
  }

  private createMaterial() {
    this.precision = "lowp";
    this.transparent = true;
    const timer = this.uTime.mul(0.01);
    const _uv1 = fract(uv().mul(0.15).add(timer));
    const _uv2 = fract(uv().mul(0.25).sub(timer));
    const nor1 = texture(assetManager.waterNormal, _uv1);
    const adjustedNor1 = vec3(
      nor1.a.mul(2).sub(1),
      nor1.b,
      nor1.g.mul(2).sub(1),
    );
    const nor2 = texture(assetManager.waterNormal, _uv2);
    const adjustedNor2 = vec3(
      nor2.a.mul(2).sub(1),
      nor2.b,
      nor2.g.mul(2).sub(1),
    );
    const nor = mix(adjustedNor1, adjustedNor2, 0.5);
    // this.normalNode = new NormalMapNode(nor, float(5));

    const viewDirection = normalize(positionWorld.sub(cameraPosition));
    const reflectedDirection = reflect(viewDirection, nor).normalize();
    const envColor = cubeTexture(
      assetManager.envMapTexture,
      reflectedDirection,
    ).mul(3);

    this.colorNode = vec4(0, 0, 1, 0.05).mul(envColor);

    // this.envMap = assetManager.envMapTexture;

    // const offset = this.uPlayerPos.xz
    //   .mul(vec2(1, -1))
    //   .add(vec2(config.AREA_X_SIZE / 2, config.AREA_Z_SIZE / 2))
    //   .div(vec2(config.AREA_X_SIZE, config.AREA_Z_SIZE));
    // const time = this.uTime.mod(2); // 2-second ripple cycle

    // const scale = 5;
    // const scaledUv = uv().sub(offset).mul(scale).add(0.5);
    // // const ripple = texture(assetManager.ripplesMask, scaledUv);
    // // this.colorNode = mix(vec3(0), ripple.rgb, ripple.a);

    // const rippleScale = float(1).add(time.mul(2)); // grows from 1 to 5
    // const rippleStrength = float(1).sub(time.div(1)); // fades from 1 to 0

    // const rippleUv = scaledUv.sub(offset).div(rippleScale).add(0.5);
    // const rotatedUv = rotateUV(rippleUv, time);

    // const ripple = texture(assetManager.ripplesMask, rotatedUv);

    // this.colorNode = ripple.mul(rippleStrength);

    // this.alphaTest = 0.05;
  }
}
