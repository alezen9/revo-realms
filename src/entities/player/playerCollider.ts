import {
  ActiveEvents,
  CoefficientCombineRule,
  ColliderDesc,
  RigidBodyDesc,
} from "@dimforge/rapier3d";
import { physicsWorld } from "../../systems";
import { RevoColliderType } from "../../systems/physics/colliderTypes";
import { playerConfig as config } from "./playerConfig";

export const createPlayerCollider = () => {
  const { x, y, z } = config.PLAYER_INITIAL_POSITION;
  const rigidBodyDesc = RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setAngularDamping(config.ANGULAR_DAMPING_IN_INVERSE_SECONDS);
  const rigidBody = physicsWorld.world.createRigidBody(rigidBodyDesc);
  const colliderDesc = createColliderDesc();
  const collider = physicsWorld.world.createCollider(colliderDesc, rigidBody);
  collider.userData = { type: RevoColliderType.Player };
  return { rigidBody, collider };
};

const createColliderDesc = () => {
  return ColliderDesc.ball(config.RADIUS_IN_METERS)
    .setRestitution(config.RESTITUTION)
    .setRestitutionCombineRule(CoefficientCombineRule.Average)
    .setFriction(config.FRICTION)
    .setFrictionCombineRule(CoefficientCombineRule.Min)
    .setMass(config.MASS_IN_KILOGRAMS)
    .setActiveEvents(ActiveEvents.COLLISION_EVENTS);
};
