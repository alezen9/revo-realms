import {
  AddEquation,
  BlendMode,
  CustomBlending,
  DirectionalLight,
  LightingModel,
  MeshLambertNodeMaterial,
  MeshStandardNodeMaterial,
  type NodeMaterial,
  OneFactor,
  PhongLightingModel,
  PhysicalLightingModel,
  type Node,
} from "three/webgpu";
import { mrt, vec3, vec4 } from "three/tsl";
import { shadowConfig } from "./config";

type LightingBuilder = Parameters<LightingModel["start"]>[0];
type Vec3Node = ReturnType<typeof vec3>;
type DirectLight = Parameters<LightingModel["direct"]>[0] & {
  reflectedLight: {
    directDiffuse: Vec3Node;
    directSpecular: Vec3Node;
  };
};

const isDirectionalLightNode = (lightNode: Node) => {
  if (!("light" in lightNode)) return false;
  return lightNode.light instanceof DirectionalLight;
};

// capture Three's own directional contribution without copying its BRDFs
class DirectSunPhongLightingModel extends PhongLightingModel {
  readonly directSun = vec3().toVar("directSun");

  constructor() {
    super(false);
  }

  direct(lightData: DirectLight, builder: LightingBuilder) {
    const { lightNode, reflectedLight } = lightData;
    if (!isDirectionalLightNode(lightNode)) {
      super.direct(lightData, builder);
      return;
    }

    const diffuseBefore = vec3().toVar("directSunDiffuseBefore");
    const specularBefore = vec3().toVar("directSunSpecularBefore");
    diffuseBefore.assign(reflectedLight.directDiffuse);
    specularBefore.assign(reflectedLight.directSpecular);

    super.direct(lightData, builder);

    const directDiffuse = vec3(reflectedLight.directDiffuse).sub(diffuseBefore);
    const directSpecular = vec3(reflectedLight.directSpecular).sub(
      specularBefore,
    );
    this.directSun.addAssign(directDiffuse.add(directSpecular));
  }
}

class DirectSunPhysicalLightingModel extends PhysicalLightingModel {
  readonly directSun = vec3().toVar("directSun");

  direct(lightData: DirectLight, builder: LightingBuilder) {
    const { lightNode, reflectedLight } = lightData;
    if (!isDirectionalLightNode(lightNode)) {
      super.direct(lightData, builder);
      return;
    }

    const diffuseBefore = vec3().toVar("directSunDiffuseBefore");
    const specularBefore = vec3().toVar("directSunSpecularBefore");
    diffuseBefore.assign(reflectedLight.directDiffuse);
    specularBefore.assign(reflectedLight.directSpecular);

    super.direct(lightData, builder);

    const directDiffuse = vec3(reflectedLight.directDiffuse).sub(diffuseBefore);
    const directSpecular = vec3(reflectedLight.directSpecular).sub(
      specularBefore,
    );
    this.directSun.addAssign(directDiffuse.add(directSpecular));
  }
}

export class DirectSunLambertNodeMaterial extends MeshLambertNodeMaterial {
  setupLightingModel() {
    if (!shadowConfig.isPagedEnabled) return super.setupLightingModel();

    const lightingModel = new DirectSunPhongLightingModel();
    this.mrtNode = mrt({ directSun: vec4(lightingModel.directSun, 1) });
    return lightingModel;
  }
}

export class DirectSunStandardNodeMaterial extends MeshStandardNodeMaterial {
  setupLightingModel() {
    if (!shadowConfig.isPagedEnabled) return super.setupLightingModel();

    const lightingModel = new DirectSunPhysicalLightingModel();
    this.mrtNode = mrt({ directSun: vec4(lightingModel.directSun, 1) });
    return lightingModel;
  }
}

export const preserveDirectSunForTransparentMaterial = (
  material: NodeMaterial,
) => {
  if (!shadowConfig.isPagedEnabled) return;

  // rgb11b10 has no alpha, so transparent effects preserve it by adding zero
  const directSunMrt = mrt({ directSun: vec4(0) });
  const additivePreserve = new BlendMode(CustomBlending);
  additivePreserve.blendEquation = AddEquation;
  additivePreserve.blendSrc = OneFactor;
  additivePreserve.blendDst = OneFactor;
  directSunMrt.setBlendMode("directSun", additivePreserve);
  material.mrtNode = directSunMrt;
};
