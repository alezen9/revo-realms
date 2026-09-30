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
    const diffuseGain = vec3(reflectedLight.directDiffuse).sub(diffuseBefore);
    const specularGain = vec3(reflectedLight.directSpecular).sub(
      specularBefore,
    );
    this.directSun.addAssign(diffuseGain.add(specularGain));
  }
}

export class VSMReceiverLambertMaterial extends MeshLambertNodeMaterial {
  softShadowNode?: Node<"float">;
  extraDirectSun?: Node<"vec3">;
  declare emissiveNode: Node<"vec3"> | null;

  setupLightingModel() {
    const lightingModel = new DirectSunPhongLightingModel();
    let sunLight: Node<"vec3"> = lightingModel.directSun;
    if (this.extraDirectSun) sunLight = sunLight.add(this.extraDirectSun);
    const directSun = vec4(sunLight, 1);
    this.mrtNode = this.softShadowNode
      ? mrt({ directSun, softShadow: vec4(this.softShadowNode) })
      : mrt({ directSun });
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
    const diffuseGain = vec3(reflectedLight.directDiffuse).sub(diffuseBefore);
    const specularGain = vec3(reflectedLight.directSpecular).sub(
      specularBefore,
    );
    this.directSun.addAssign(diffuseGain.add(specularGain));
  }
}

export class VSMReceiverStandardMaterial extends MeshStandardNodeMaterial {
  setupLightingModel() {
    const lightingModel = new DirectSunPhysicalLightingModel();
    this.mrtNode = mrt({ directSun: vec4(lightingModel.directSun, 1) });
    return lightingModel;
  }
}
