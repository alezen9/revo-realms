import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  LOD,
  Matrix4,
  Sphere,
  StaticDrawUsage,
  Vector2,
  Vector3,
} from "three";
import { sceneManager } from "../../../systems/SceneManager";
import {
  float,
  floor,
  step,
  abs,
  vec3,
  uniform,
  Fn,
  instancedArray,
  instanceIndex,
  hash,
  texture,
  vec2,
  positionWorld,
  rotate,
  time,
  mix,
  smoothstep,
  clamp,
  vec4,
  positionLocal,
  uv,
  sin,
  min,
  max,
} from "three/tsl";
import { eventsManager } from "../../../systems/EventsManager";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assetManager } from "../../../systems/AssetManager";
import { tslUtils } from "../../../utils/TSLUtils";
import { rendererManager } from "../../../systems/RendererManager";

const getConfig = () => {
  const BLADE_WIDTH = 0.075;
  const BLADE_HEIGHT = 1.45;
  const TILE_SIZE = 40;
  const BLADES_PER_SIDE = 100;
  const SEGMENTS = 7; // must be odd

  const boundingSphereCenter = new Vector3(TILE_SIZE / 2, 0, TILE_SIZE / 2);
  const boundingSphereRadius = TILE_SIZE * 1.5;
  return {
    BLADE_WIDTH,
    BLADE_HEIGHT,
    BLADE_BOUNDING_SPHERE_RADIUS: BLADE_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    BLADES_PER_SIDE,
    COUNT: BLADES_PER_SIDE * BLADES_PER_SIDE,
    SPACING: TILE_SIZE / BLADES_PER_SIDE,
    SEGMENTS,
    BOUNDING_SPHERE: new Sphere(boundingSphereCenter, boundingSphereRadius),
  };
};
const config = getConfig();

const uniforms = {
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uCameraMatrix: uniform(new Matrix4()),
  // Scale
  uBladeMinScale: uniform(0.5),
  uBladeMaxScale: uniform(1.25),
  // Trail
  uTrailGrowthRate: uniform(0.004),
  uTrailMinScale: uniform(0.25),
  uTrailRaius: uniform(0.65),
  uTrailRaiusSquared: uniform(0.65 * 0.65),
  // Glow
  uGlowRadius: uniform(2),
  uGlowRadiusSquared: uniform(4),
  uGlowFadeIn: uniform(0.05),
  uGlowFadeOut: uniform(0.01),
  uGlowColor: uniform(new Color().setRGB(0.39, 0.14, 0.02)),
  // Bending
  uBladeMaxBendAngle: uniform(Math.PI * 0.15),
  uWindStrength: uniform(0.6),
  // Color
  uBaseColor: uniform(new Color().setRGB(0.07, 0.07, 0)), // Light
  uTipColor: uniform(new Color().setRGB(0.23, 0.11, 0.05)), // Light
  // uBaseColor: uniform(new Color().setRGB(0.0, 0.01, 0.01)), // Dark
  // uTipColor: uniform(new Color().setRGB(0.0, 0.11, 0.06)), // Dark
  // Updated externally
  uDelta: uniform(new Vector2(0, 0)),
  uGlowMul: uniform(1),

  // uR0: uniform(grassConfig.TILE_HALF_SIZE * 0.25),
  // uR1: uniform(grassConfig.TILE_HALF_SIZE * 0.95),
  // uPMin: uniform(0.1),

  uWindSpeed: uniform(0.25),
};

class GrassMaterial extends MeshBasicNodeMaterial {
  private ssbo: GrassSsbo;
  constructor(ssbo: GrassSsbo) {
    super();
    this.ssbo = ssbo;
    this.createGrassMaterial();
  }

  private computePosition = Fn(
    ([
      offsetX = float(0),
      offsetZ = float(0),
      yawAngle = float(0),
      bendingAngle = float(0),
      scale = float(0),
      glowFactor = float(0),
    ]) => {
      const offset = vec3(offsetX, 0, offsetZ);
      const bendAmount = bendingAngle.mul(uv().y);
      const bentPosition = rotate(positionLocal, vec3(bendAmount, 0, 0));
      const scaled = bentPosition.mul(vec3(1, scale, 1));
      const rotated = rotate(scaled, vec3(0, yawAngle, 0));
      const randomPhase = hash(instanceIndex).mul(6.28); // Random phase in range [0, 2π]
      const swayAmount = sin(
        time.mul(5).add(bendingAngle).add(randomPhase),
      ).mul(0.1);
      const swayFactor = uv().y.mul(glowFactor);
      const swayOffset = swayAmount.mul(swayFactor);
      const worldPosition = rotated.add(offset).add(vec3(swayOffset));
      return worldPosition;
    },
  );

  private computeDiffuseColor = Fn(
    ([glowFactor = float(0), isShadow = float(1)]) => {
      const verticalFactor = uv().y;
      const baseToTip = mix(
        uniforms.uBaseColor,
        uniforms.uTipColor,
        verticalFactor,
      );

      const tint = hash(instanceIndex.add(1000)).mul(0.03).add(0.985);
      const variedColor = baseToTip.mul(tint).clamp();

      const finalColor = mix(
        variedColor,
        uniforms.uGlowColor.mul(uniforms.uGlowMul),
        glowFactor,
      );

      const diff = mix(finalColor.mul(0.5), finalColor, isShadow);

      return diff;
    },
  );

  private computeAlpha = Fn(() => {
    const alphaUv = tslUtils.computeMapUvByPosition(positionWorld.xz);
    const alpha = texture(assetManager.terrainTypeMap, alphaUv).g;
    const threshold = step(0.25, alpha);
    return alpha.mul(threshold);
  });

  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;
    const data = this.ssbo.computeBuffer.element(instanceIndex);

    const offsetX = data.x;
    const offsetZ = data.y;
    const yawAngle = this.ssbo.getYaw(data);
    const bendingAngle = this.ssbo.getBend(data);
    const scale = this.ssbo.getScale(data);
    const glowFactor = this.ssbo.getGlow(data);

    this.positionNode = this.computePosition(
      offsetX,
      offsetZ,
      yawAngle,
      bendingAngle,
      scale,
      glowFactor,
    );
    const alpha = this.computeAlpha();
    this.opacityNode = alpha;
    this.alphaTest = 0.5;
    this.colorNode = this.computeDiffuseColor(glowFactor, 1);
  }
}

class GrassSsbo {
  // x -> offsetX (0 unused)
  // y -> offsetZ (0 unused)
  // z -> 0/12 yaw - 12/12 bend (0 unused)
  // w -> 0/8 current scale - 8/8 original scale - 16/1 shadow - 17/1 visibility - 18/4 glow factor (0 unused)
  private buffer = instancedArray(config.COUNT, "vec4");

  constructor() {
    this.buffer.setPBO(true);
    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
  }

  get computeBuffer() {
    return this.buffer;
  }

  getYaw = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnits(data.z, 0, 12, -Math.PI, Math.PI);
  });

  getBend = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnits(data.z, 12, 12, -Math.PI, Math.PI);
  });

  getScale = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnits(
      data.w,
      0,
      8,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
  });

  getOriginalScale = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnits(
      data.w,
      8,
      8,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
  });

  getGlow = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnit(data.w, 18, 6);
  });

  private setYaw = Fn(([data = vec4(0), value = float(0)]) => {
    data.z = tslUtils.packUnits(data.z, 0, 12, value, -Math.PI, Math.PI);
    return data;
  });

  private setBend = Fn(([data = vec4(0), value = float(0)]) => {
    data.z = tslUtils.packUnits(data.z, 12, 12, value, -Math.PI, Math.PI);
    return data;
  });

  private setScale = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = tslUtils.packUnits(
      data.w,
      0,
      8,
      value,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
    return data;
  });

  private setOriginalScale = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = tslUtils.packUnits(
      data.w,
      8,
      8,
      value,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
    return data;
  });

  private setGlow = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = tslUtils.packUnit(data.w, 18, 6, value);
    return data;
  });

  private computeInit = Fn(() => {
    const data = this.buffer.element(instanceIndex);

    // Position XZ
    const row = floor(float(instanceIndex).div(config.BLADES_PER_SIDE));
    const col = float(instanceIndex).mod(config.BLADES_PER_SIDE);

    const randX = hash(instanceIndex.add(4321));
    const randZ = hash(instanceIndex.add(1234));

    const offsetX = col
      .mul(config.SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randX.mul(config.SPACING * 0.5));
    const offsetZ = row
      .mul(config.SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randZ.mul(config.SPACING * 0.5));

    const _uv = vec3(offsetX, 0, offsetZ)
      .xz.add(config.TILE_HALF_SIZE)
      .div(config.TILE_SIZE)
      .abs();

    const noise = texture(assetManager.noiseTexture, _uv);
    const noiseX = noise.b.sub(0.5).mul(17);
    const noiseZ = noise.b.sub(0.5).mul(13);

    data.x = offsetX.add(noiseX);
    data.y = offsetZ.add(noiseZ);

    // Yaw
    const yaw = noise.b.sub(0.5).mul(float(Math.PI * 2)); // Map noise to [-PI, PI]
    data.assign(this.setYaw(data, yaw));

    // Scale
    const scaleRange = uniforms.uBladeMaxScale.sub(uniforms.uBladeMinScale);
    const randomScale = noise.r.mul(scaleRange).add(uniforms.uBladeMinScale);

    data.assign(this.setScale(data, randomScale));
    data.assign(this.setOriginalScale(data, randomScale));
  })().compute(config.COUNT);

  private computeBending = Fn(
    ([prevBending = float(0), worldPos = vec3(0)]) => {
      const windUV = worldPos.xz
        .add(time.mul(uniforms.uWindSpeed))
        .mul(0.5)
        .fract();

      const windStrength = texture(assetManager.noiseTexture, windUV, 2).r;

      const targetBendAngle = windStrength.mul(uniforms.uWindStrength);

      return prevBending.add(targetBendAngle.sub(prevBending).mul(0.1));
    },
  );

  private computeTrailScale = Fn(
    ([
      originalScale = float(0),
      currentScale = float(0),
      isBladeSteppedOn = float(0),
    ]) => {
      const growScale = currentScale.add(uniforms.uTrailGrowthRate);

      const growScaleFactor = float(1).sub(isBladeSteppedOn);
      const targetScale = uniforms.uTrailMinScale
        .mul(isBladeSteppedOn)
        .add(growScale.mul(growScaleFactor));

      return min(targetScale, originalScale);
    },
  );

  private computeTrailGlow = Fn(
    ([
      prevGlow = float(0),
      distSq = float(0),
      isBladeSteppedOn = float(0),
      isPlayerGrounded = float(0),
    ]) => {
      const glowRadiusFactor = smoothstep(
        uniforms.uGlowRadiusSquared, // Outer radius (low intensity)
        float(0), // Inner radius (high intensity)
        distSq, // Distance squared to player
      );
      // Check if the player is moving (prevents constant glow when stationary)
      const precision = 100.0;
      const absDeltaX = floor(abs(uniforms.uDelta.x).mul(precision));
      const absDeltaZ = floor(abs(uniforms.uDelta.y).mul(precision));
      // Step function correctly returns 1 if sum > 0, else 0
      const isPlayerMoving = step(1.0, absDeltaX.add(absDeltaZ));
      // Base glow factor (only applies if within radius, not squished, and player grounded)
      const baseGlowFactor = glowRadiusFactor
        .mul(float(1).sub(isBladeSteppedOn))
        .mul(isPlayerGrounded);
      // If moving or glow was already active, apply glow effect
      const isBladeAffected = max(isPlayerMoving, prevGlow).mul(baseGlowFactor);
      // Compute fade-in when affected, fade-out when not affected
      const fadeIn = isBladeAffected.mul(uniforms.uGlowFadeIn);
      const fadeOut = float(1).sub(isBladeAffected).mul(uniforms.uGlowFadeOut);
      // Force fade-out when **fully stationary**
      const forceFadeOut = float(1)
        .sub(isPlayerMoving)
        .mul(uniforms.uGlowFadeOut)
        .mul(prevGlow);
      // Apply glow effect and ensure full fade-out when stationary
      return clamp(
        prevGlow.add(fadeIn).sub(fadeOut).sub(forceFadeOut),
        0.0,
        1.0,
      );
    },
  );

  computeUpdate = Fn(() => {
    const data = this.buffer.element(instanceIndex);

    // Position
    const pos = vec3(data.x, 0, data.y);
    // const worldPos = pos.add(uniforms.uPlayerPosition);

    // Compute distance to player
    const playerPos = vec2(uniforms.uDelta.x, uniforms.uDelta.y);
    const diff = pos.xz.sub(playerPos);
    const distSq = diff.dot(diff);

    // Check if the player is on the ground
    const isPlayerGrounded = step(
      0.1,
      float(1).sub(uniforms.uPlayerPosition.y),
    ); // 1 if grounded, 0 if airborne

    const isBladeSteppedOn = step(distSq, uniforms.uTrailRaiusSquared).mul(
      isPlayerGrounded,
    ); // 1 if stepped on, 0 if not

    // Trail
    const currentScale = this.getScale(data);
    const originalScale = this.getOriginalScale(data);
    const newScale = this.computeTrailScale(
      originalScale,
      currentScale,
      isBladeSteppedOn,
    );
    data.assign(this.setScale(data, newScale));

    // Wind
    const prevBending = this.getBend(data);
    const newBending = this.computeBending(prevBending, pos);
    data.assign(this.setBend(data, newBending));

    // Glow
    const prevGlow = this.getGlow(data);
    const newGlow = this.computeTrailGlow(
      prevGlow,
      distSq,
      isBladeSteppedOn,
      isPlayerGrounded,
    );

    data.assign(this.setGlow(data, newGlow));
  })().compute(config.COUNT);
}

export default class GrassTiles {
  private group = new Group();
  private nGrid = 5;

  constructor() {
    const ssbo = new GrassSsbo();
    const material = new GrassMaterial(ssbo);

    const geometries = [
      this.createGeometry(5),
      this.createGeometry(3),
      this.createGeometry(1),
    ];
    this.group = this.createGrid(material, geometries);
    sceneManager.scene.add(this.group);
    eventsManager.on("update-throttle-2x", ({ player }) => {
      const dx = player.position.x - this.group.position.x;
      const dz = player.position.z - this.group.position.z;
      uniforms.uDelta.value.set(dx, dz);
      const distSq = dx * dx + dz * dz;

      uniforms.uPlayerPosition.value.copy(player.position);
      uniforms.uCameraMatrix.value
        .copy(sceneManager.playerCamera.projectionMatrix)
        .multiply(sceneManager.playerCamera.matrixWorldInverse);

      rendererManager.renderer.computeAsync(ssbo.computeUpdate);

      if (distSq < config.TILE_SIZE * config.TILE_SIZE) return; // don't move if within 1 tile
      this.group.position.x =
        Math.round(player.position.x / config.TILE_SIZE) * config.TILE_SIZE;
      this.group.position.z =
        Math.round(player.position.z / config.TILE_SIZE) * config.TILE_SIZE;

      this.wrapTiles(dx, dz);
    });
  }

  private createGrid(material: GrassMaterial, geometries: BufferGeometry[]) {
    const group = new Group();
    let idx = 0;
    for (let i = 0; i < this.nGrid; i++) {
      for (let j = 0; j < this.nGrid; j++) {
        idx++;
        const x = (i - Math.floor(this.nGrid / 2)) * config.TILE_SIZE;
        const z = (j - Math.floor(this.nGrid / 2)) * config.TILE_SIZE;
        const tile = this.createTile(material, geometries);
        tile.position.set(x, 0, z);

        // // add text geometry label to tile with the incremental index
        // const textGeom = new TextGeometry(`${idx}`, {
        //   font: assetManager.font,
        //   size: 5,
        //   depth: 0.2,
        //   curveSegments: 12,
        //   bevelEnabled: false,
        // });
        // textGeom.center();
        // textGeom.rotateX(-Math.PI / 2);
        // textGeom.translate(0, 0.2, 0);
        // const textMaterial = new MeshBasicMaterial({ color: "white" });
        // const textMesh = new Mesh(textGeom, textMaterial);
        // tile.add(textMesh);

        group.add(tile);
      }
    }
    return group;
  }

  private wrapTiles(dx: number, dz: number) {
    // move tiles opposite to player movement and wrap around
    this.group.children.forEach((tile) => {
      tile.position.x -= config.TILE_SIZE * Math.sign(dx);
      tile.position.z -= config.TILE_SIZE * Math.sign(dz);
      if (Math.abs(tile.position.x) > (this.nGrid / 2) * config.TILE_SIZE) {
        tile.position.x -=
          Math.sign(tile.position.x) * this.nGrid * config.TILE_SIZE;
      }
      if (Math.abs(tile.position.z) > (this.nGrid / 2) * config.TILE_SIZE) {
        tile.position.z -=
          Math.sign(tile.position.z) * this.nGrid * config.TILE_SIZE;
      }
    });
  }

  private createGeometry(nSegments: number) {
    const segments = Math.max(1, Math.floor(nSegments)); // total vertical slices
    const height = config.BLADE_HEIGHT;
    const halfWidthBase = config.BLADE_WIDTH * 0.5;

    // We have `segments` rows of (L,R) vertices, then a single tip vertex.
    const rowCount = segments; // #pair-rows
    const vertexCount = rowCount * 2 + 1; // 2 per row + tip
    const quadCount = Math.max(0, rowCount - 1); // quads between consecutive rows
    const indexCount = quadCount * 6 + 3; // 6 per quad + 3 for tip

    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = new Uint8Array(indexCount);

    // simple taper: ~linear → narrower toward tip; tweak as you like
    const taper = (t: number) => halfWidthBase * (1.0 - 0.7 * t); // t in [0..1]

    // build rows
    let idx = 0; // write cursor for indices
    for (let row = 0; row < rowCount; row++) {
      const v = row / segments; // normalized height [0..(segments-1)/segments]
      const y = v * height;
      const halfWidth = taper(v);

      const left = row * 2;
      const right = left + 1;

      // positions
      positions[3 * left + 0] = -halfWidth;
      positions[3 * left + 1] = y;
      positions[3 * left + 2] = 0;

      positions[3 * right + 0] = halfWidth;
      positions[3 * right + 1] = y;
      positions[3 * right + 2] = 0;

      // uvs (L=0, R=1; V along height)
      uvs[2 * left + 0] = 0.0;
      uvs[2 * left + 1] = v;
      uvs[2 * right + 0] = 1.0;
      uvs[2 * right + 1] = v;

      // make a quad with the previous row (except for the very first row)
      if (row > 0) {
        const prevLeft = (row - 1) * 2;
        const prevRight = prevLeft + 1;

        // (prevL, prevR, currR) and (prevL, currR, currL)
        indices[idx++] = prevLeft;
        indices[idx++] = prevRight;
        indices[idx++] = right;

        indices[idx++] = prevLeft;
        indices[idx++] = right;
        indices[idx++] = left;
      }
    }

    // tip vertex at full height
    const tip = rowCount * 2;
    positions[3 * tip + 0] = 0;
    positions[3 * tip + 1] = height;
    positions[3 * tip + 2] = 0;
    uvs[2 * tip + 0] = 0.5;
    uvs[2 * tip + 1] = 1.0;

    // connect last row to tip (single triangle)
    const lastLeft = (rowCount - 1) * 2;
    const lastRight = lastLeft + 1;
    indices[idx++] = lastLeft;
    indices[idx++] = lastRight;
    indices[idx++] = tip;

    // assemble geometry
    const geom = new BufferGeometry();

    const posAttribute = new BufferAttribute(positions, 3);
    posAttribute.setUsage(StaticDrawUsage);
    geom.setAttribute("position", posAttribute);

    const uvAttribute = new BufferAttribute(uvs, 2);
    uvAttribute.setUsage(StaticDrawUsage);
    geom.setAttribute("uv", uvAttribute);

    const indexAttribute = new BufferAttribute(indices, 1);
    indexAttribute.setUsage(StaticDrawUsage);
    geom.setIndex(indexAttribute);
    return geom;
  }

  private createTile(material: GrassMaterial, geometries: BufferGeometry[]) {
    const lod = new LOD();
    const meshHigh = new InstancedMesh(geometries[0], material, config.COUNT);
    meshHigh.boundingSphere = config.BOUNDING_SPHERE;
    lod.addLevel(meshHigh, 0);
    const meshMid = new InstancedMesh(geometries[1], material, config.COUNT);
    meshMid.boundingSphere = config.BOUNDING_SPHERE;
    lod.addLevel(meshMid, 50);
    const meshLow = new InstancedMesh(geometries[2], material, config.COUNT);
    meshLow.boundingSphere = config.BOUNDING_SPHERE;
    lod.addLevel(meshLow, 100);
    return lod;
  }
}
