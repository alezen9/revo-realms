import type { Collider } from "@dimforge/rapier3d";
import { debugManager } from "../../systems";
import { playerConfig as config } from "./config";
import { playerUniforms } from "./PlayerMaterial";

export const debugPlayer = (collider: Collider) => {
  const folder = debugManager.panel.addFolder({
    title: "⚽️ Player",
    expanded: false,
  });

  const physics = folder.addFolder({ title: "Physics" });
  physics.addBinding(config, "LIN_VEL_STRENGTH_IN_METERS_PER_SECOND_SQUARED", {
    label: "Acceleration",
    min: 5,
    max: 150,
  });
  physics.addBinding(config, "MAX_SPEED_IN_METERS_PER_SECOND", {
    label: "Max speed",
    min: 5,
    max: 100,
  });
  physics.addBinding(config, "TURN_SPEED_IN_RADIANS_PER_SECOND", {
    label: "Turn speed",
    min: 0.5,
    max: 8,
    step: 0.1,
  });
  physics.addBinding(config, "AIR_CONTROL_FACTOR", {
    label: "Air control",
    min: 0,
    max: 1,
  });
  physics
    .addBinding(config, "RESTITUTION", {
      label: "Bounciness",
      min: 0,
      max: 1,
    })
    .on("change", ({ value }) => collider.setRestitution(value));
  physics.addBinding(config, "FALL_MULTIPLIER", {
    label: "Fall multiplier",
    min: 0,
    max: 10,
  });

  const jump = folder.addFolder({ title: "Jump" });
  jump.addBinding(config, "JUMP_VELOCITY_IN_METERS_PER_SECOND", {
    label: "Jump velocity",
    min: 1,
    max: 14,
  });
  jump.addBinding(config, "DOUBLE_JUMP_VELOCITY_IN_METERS_PER_SECOND", {
    label: "Double jump",
    min: 1,
    max: 14,
  });
  jump.addBinding(config, "JUMP_CUT_MULTIPLIER", {
    label: "Jump cut",
    min: 0.1,
    max: 1,
  });

  const water = folder.addFolder({ title: "Water" });
  water.addBinding(config, "BUOYANCY_FORCE_IN_NEWTONS", {
    label: "Buoyancy",
    min: 1,
    max: 20,
  });
  water.addBinding(config, "WATER_VERTICAL_DAMPING_IN_INVERSE_SECONDS", {
    label: "Vertical damp",
    min: 0,
    max: 10,
  });
  water.addBinding(config, "WATER_BOB_FORCE_IN_NEWTONS", {
    label: "Bob strength",
    min: 0,
    max: 10,
  });

  const visuals = folder.addFolder({ title: "Visuals" });
  visuals.addBinding(config, "ACCELERATION_SQUASH_STRENGTH", {
    label: "Acceleration",
    min: 0,
    max: 0.08,
    step: 0.001,
  });
  visuals.addBinding(config, "JUMP_STRETCH_STRENGTH", {
    label: "Jump stretch",
    min: 0,
    max: 0.6,
    step: 0.01,
  });
  visuals.addBinding(config, "LANDING_SQUASH_STRENGTH", {
    label: "Landing",
    min: 0,
    max: 0.35,
    step: 0.01,
  });
  visuals.addBinding(config, "IMPACT_SQUASH_STRENGTH", {
    label: "Impact",
    min: 0,
    max: 0.2,
    step: 0.005,
  });
  visuals.addBinding(config, "SQUASH_RECOVERY_SPEED_IN_INVERSE_SECONDS", {
    label: "Recovery",
    min: 1,
    max: 40,
    step: 0.5,
  });
  visuals.addBinding(config, "MAX_SQUASH_DEFORMATION", {
    label: "Max deform",
    min: 0,
    max: 0.4,
    step: 0.01,
  });
  visuals
    .addBinding(config, "SPIN_BLUR_MAX", {
      label: "Spin blur",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", ({ value }) => (playerUniforms.uSpinBlurMax.value = value));
  visuals.addBinding(playerUniforms.uDiffuseScale, "value", {
    label: "Diffuse scale",
    min: 0,
    max: 4,
    step: 0.01,
  });
  visuals.addBinding(playerUniforms.uSunTintStrength, "value", {
    label: "Sun tint",
    min: 0,
    max: 1,
    step: 0.01,
  });
};
