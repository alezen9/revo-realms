import {
  DirectionalLight,
  MeshLambertNodeMaterial,
  MeshStandardNodeMaterial,
  PhongLightingModel,
  PhysicalLightingModel,
  type LightingModel,
  type Node,
} from "three/webgpu";
import { mrt, vec3, vec4 } from "three/tsl";
import { isDirectSunMaterialCaptureEnabled } from "./config";

type LightingBuilder = Parameters<LightingModel["start"]>[0];
type DirectLight = Parameters<LightingModel["direct"]>[0] & {
  reflectedLight: {
    directDiffuse: ReturnType<typeof vec3>;
    directSpecular: ReturnType<typeof vec3>;
  };
};

class DirectSunPhongLightingModel extends PhongLightingModel {
  readonly directSun = vec3().toVar("directSun");

  constructor() {
    super(false);
  }

  direct(lightData: DirectLight, builder: LightingBuilder) {
    const { lightNode, reflectedLight } = lightData;
    if (
      !("light" in lightNode) ||
      !(lightNode.light instanceof DirectionalLight)
    ) {
      super.direct(lightData, builder);
      return;
    }

    const diffuseBefore = vec3(reflectedLight.directDiffuse).toVar();
    const specularBefore = vec3(reflectedLight.directSpecular).toVar();
    super.direct(lightData, builder);
    this.directSun.addAssign(
      vec3(reflectedLight.directDiffuse)
        .sub(diffuseBefore)
        .add(vec3(reflectedLight.directSpecular).sub(specularBefore)),
    );
  }
}

export class DirectSunLambertNodeMaterial extends MeshLambertNodeMaterial {
  setupLightingModel() {
    if (!isDirectSunMaterialCaptureEnabled) return super.setupLightingModel();

    const lightingModel = new DirectSunPhongLightingModel();
    this.mrtNode = mrt({ directSun: vec4(lightingModel.directSun, 1) });
    return lightingModel;
  }
}

class DirectSunPhysicalLightingModel extends PhysicalLightingModel {
  readonly directSun = vec3().toVar("directSun");

  direct(lightData: DirectLight, builder: LightingBuilder) {
    const { lightNode, reflectedLight } = lightData;
    if (
      !("light" in lightNode) ||
      !(lightNode.light instanceof DirectionalLight)
    ) {
      super.direct(lightData, builder);
      return;
    }

    const diffuseBefore = vec3(reflectedLight.directDiffuse).toVar();
    const specularBefore = vec3(reflectedLight.directSpecular).toVar();
    super.direct(lightData, builder);
    this.directSun.addAssign(
      vec3(reflectedLight.directDiffuse)
        .sub(diffuseBefore)
        .add(vec3(reflectedLight.directSpecular).sub(specularBefore)),
    );
  }
}

export class DirectSunStandardNodeMaterial extends MeshStandardNodeMaterial {
  setupLightingModel() {
    if (!isDirectSunMaterialCaptureEnabled) return super.setupLightingModel();

    const lightingModel = new DirectSunPhysicalLightingModel();
    this.mrtNode = mrt({ directSun: vec4(lightingModel.directSun, 1) });
    return lightingModel;
  }
}
