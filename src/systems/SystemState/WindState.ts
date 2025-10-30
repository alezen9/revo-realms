// WindState.ts
import { Vector2, Vector3 } from "three";
import { uniform } from "three/tsl";
import { FolderApi } from "tweakpane";
import { createMachine, createActor } from "xstate";
import { eventsManager } from "../EventsManager";

// ---- Domain types ----
export type WindTarget = {
  id: string;
  label: string;
  position: Vector3; // externally owned; read x/z only
  greenZoneSq: number; // arrival radius^2
};

type PlayerRef = { position: Vector3 };

// ---- Config ----
export interface WindStateConfig {
  sleepTime: number; // seconds
  decayRate: number; // 1/s
  riseRate: number; // 1/s
  turnSpeed: number; // rad/s
  holdTime: number; // seconds
}

// ---- Events ----
type TickEvent = { type: "TICK"; dt: number; player: PlayerRef };
type ActivateEvent = { type: "ACTIVATE_TARGET"; id: string };
type RemoveEvent = { type: "REMOVE_TARGET"; id: string };
type UpdateCfgEvent = {
  type: "UPDATE_CONFIG";
  patch: Partial<WindStateConfig>;
};

type WindEvent = TickEvent | ActivateEvent | RemoveEvent | UpdateCfgEvent;

// Machine context (unused; keep it empty but typed)
type MachineContext = Record<string, never>;

export class WindState {
  // === Public uniforms (TSL) ===
  private _uDirection = uniform(new Vector2(0, -1)); // XZ normalized
  private _uIntensity = uniform(0); // 0..1

  // === Targets & bookkeeping ===
  private targets = new Map<string, WindTarget>();
  private idCounter = 0;
  private activeTargetId: string | null = null;

  // === Loop timers (seconds) ===
  private sleepTimer = 0;
  private holdTimer = 0;

  // === Config (your latest values) ===
  readonly config: WindStateConfig = {
    sleepTime: 3,
    decayRate: 0.5,
    riseRate: 0.75,
    turnSpeed: 0.5,
    holdTime: 1.5,
  };

  // === Temp vectors to avoid GC in hot path ===
  private tmpDesiredDir = new Vector2(); // desired XZ for actions
  private tmpDesiredGuard = new Vector2(); // desired XZ for guards
  private tmpPlayerXZ = new Vector2();
  private tmpTargetXZ = new Vector2();

  // === Preallocated tick event to avoid per-frame allocations ===
  private tickEvent: TickEvent = {
    type: "TICK",
    dt: 0,
    player: { position: new Vector3() },
  };

  // === Machine (typed v5) ===
  private machine = createMachine(
    {
      id: "wind",
      types: {} as { context: MachineContext; events: WindEvent },
      context: {} as MachineContext,
      initial: "idle",

      on: {
        UPDATE_CONFIG: { actions: ["updateConfig"] },

        ACTIVATE_TARGET: [
          {
            guard: "targetExists",
            target: "#active.sleep",
            actions: ["setActiveTarget", "resetLoop"],
          },
        ],

        REMOVE_TARGET: [
          {
            guard: "isRemovingActive",
            target: "#arriving",
            actions: ["removeTargetKeepFading"],
          },
          { actions: ["removeTargetSilent"] },
        ],
      },

      states: {
        idle: {
          id: "idle",
          on: {
            TICK: { actions: ["writeUniformsIdle"] },
            ACTIVATE_TARGET: {
              guard: "targetExists",
              target: "#active.sleep",
              actions: ["setActiveTarget", "resetLoop"],
            },
          },
        },

        active: {
          id: "active",
          initial: "sleep",

          states: {
            // 1) Sleep
            sleep: {
              on: {
                TICK: [
                  { guard: "targetReached", target: "#arriving" },
                  {
                    guard: "sleepDone",
                    target: "decay",
                    actions: [
                      "resetSleep",
                      "computeDesiredDir",
                      "writeUniforms",
                    ],
                  },
                  {
                    actions: ["accSleep", "computeDesiredDir", "writeUniforms"],
                  },
                ],
              },
            },

            // 2) Decay intensity -> 0
            decay: {
              on: {
                TICK: [
                  { guard: "targetReached", target: "#arriving" },
                  {
                    guard: "intensityIsZero",
                    target: "turn",
                    actions: ["computeDesiredDir", "writeUniforms"],
                  },
                  {
                    actions: [
                      "decayIntensity",
                      "computeDesiredDir",
                      "writeUniforms",
                    ],
                  },
                ],
              },
            },

            // 3) Turn towards desired direction (shortest signed angle)
            turn: {
              on: {
                TICK: [
                  { guard: "targetReached", target: "#arriving" },

                  // dt-aware finish: if we can complete this tick, snap & proceed
                  {
                    guard: "willFinishTurnThisTick",
                    target: "rise",
                    actions: [
                      "computeDesiredDir",
                      "snapDirectionToDesired",
                      "writeUniforms",
                    ],
                  },

                  // else rotate a bounded step
                  {
                    actions: [
                      "computeDesiredDir",
                      "rotateTowardsDesired",
                      "writeUniforms",
                    ],
                  },
                ],
              },
            },

            // 4) Rise intensity -> 1
            rise: {
              on: {
                TICK: [
                  { guard: "targetReached", target: "#arriving" },
                  {
                    guard: "intensityIsOne",
                    target: "hold",
                    actions: ["computeDesiredDir", "writeUniforms"],
                  },
                  {
                    actions: [
                      "raiseIntensity",
                      "computeDesiredDir",
                      "writeUniforms",
                    ],
                  },
                ],
              },
            },

            // 5) Hold at 1 for a bit
            hold: {
              on: {
                TICK: [
                  { guard: "targetReached", target: "#arriving" },
                  {
                    guard: "holdDone",
                    target: "sleep",
                    actions: [
                      "resetHold",
                      "computeDesiredDir",
                      "writeUniforms",
                    ],
                  },
                  {
                    actions: ["accHold", "computeDesiredDir", "writeUniforms"],
                  },
                ],
              },
            },
          },
        },

        // Graceful exit: decay to 0 then clear and go idle
        arriving: {
          id: "arriving",
          on: {
            TICK: [
              {
                guard: "intensityIsZero",
                target: "#idle",
                actions: ["clearActiveTarget", "writeUniforms"],
              },
              { actions: ["decayIntensity", "writeUniforms"] },
            ],
          },
        },
      },
    },
    {
      // ---- Guards ----
      guards: {
        targetExists: ({ event }) =>
          event.type === "ACTIVATE_TARGET" && this.targets.has(event.id),

        isRemovingActive: ({ event }) =>
          event.type === "REMOVE_TARGET" && this.activeTargetId === event.id,

        targetReached: ({ event }) => {
          if (event.type !== "TICK" || !this.activeTargetId) return false;
          const t = this.targets.get(this.activeTargetId);
          if (!t) return false;
          const p = event.player.position;
          this.tmpPlayerXZ.set(p.x, p.z);
          this.tmpTargetXZ.set(t.position.x, t.position.z);
          const dx = this.tmpTargetXZ.x - this.tmpPlayerXZ.x;
          const dy = this.tmpTargetXZ.y - this.tmpPlayerXZ.y;
          const d2 = dx * dx + dy * dy;
          return d2 <= t.greenZoneSq;
        },

        sleepDone: () => this.sleepTimer >= this.config.sleepTime,
        holdDone: () => this.holdTimer >= this.config.holdTime,
        intensityIsZero: () => this._uIntensity.value <= 0,
        intensityIsOne: () => this._uIntensity.value >= 1,

        // dt-aware finish check computed against FRESH desired (no stale tmp)
        willFinishTurnThisTick: ({ event }) => {
          if (event.type !== "TICK" || !this.activeTargetId) return false;
          const t = this.targets.get(this.activeTargetId);
          if (!t) return false;
          // compute desired XZ
          const p = event.player.position;
          this.tmpDesiredGuard
            .set(t.position.x - p.x, t.position.z - p.z)
            .normalize();

          const dir = this._uDirection.value;
          const rem = this.signedAngleBetween(
            dir.x,
            dir.y,
            this.tmpDesiredGuard.x,
            this.tmpDesiredGuard.y,
          );
          if (!isFinite(rem)) return false;

          const maxStep = this.config.turnSpeed * event.dt;
          return Math.abs(rem) <= maxStep;
        },
      },

      // ---- Actions ----
      actions: {
        // Config
        updateConfig: ({ event }) => {
          if (event.type !== "UPDATE_CONFIG") return;
          Object.assign(this.config, event.patch);
        },

        // Target mgmt
        setActiveTarget: ({ event }) => {
          if (event.type !== "ACTIVATE_TARGET") return;
          this.activeTargetId = event.id;
        },
        clearActiveTarget: () => {
          this.activeTargetId = null;
        },
        removeTargetKeepFading: ({ event }) => {
          if (event.type !== "REMOVE_TARGET") return;
          this.targets.delete(event.id);
        },
        removeTargetSilent: ({ event }) => {
          if (event.type !== "REMOVE_TARGET") return;
          this.targets.delete(event.id);
        },

        // Loop control
        resetLoop: () => {
          this.sleepTimer = 0;
          this.holdTimer = 0;
        },
        resetSleep: () => {
          this.sleepTimer = 0;
        },
        accSleep: ({ event }) => {
          if (event.type === "TICK") this.sleepTimer += event.dt;
        },
        resetHold: () => {
          this.holdTimer = 0;
        },
        accHold: ({ event }) => {
          if (event.type === "TICK") this.holdTimer += event.dt;
        },

        // Direction & intensity
        computeDesiredDir: ({ event }) => {
          if (event.type !== "TICK" || !this.activeTargetId) return;
          const t = this.targets.get(this.activeTargetId);
          if (!t) return;
          const p = event.player.position;
          this.tmpDesiredDir
            .set(t.position.x - p.x, t.position.z - p.z)
            .normalize();
        },

        decayIntensity: ({ event }) => {
          if (event.type !== "TICK") return;
          const v = this._uIntensity.value - event.dt * this.config.decayRate;
          this._uIntensity.value = v <= 0 ? 0 : v;
        },

        raiseIntensity: ({ event }) => {
          if (event.type !== "TICK") return;
          const v = this._uIntensity.value + event.dt * this.config.riseRate;
          this._uIntensity.value = v >= 1 ? 1 : v;
        },

        rotateTowardsDesired: ({ event }) => {
          if (event.type !== "TICK") return;
          // Use SIGNED smallest angle via cross/dot
          const dir = this._uDirection.value;
          const des = this.tmpDesiredDir;
          const remaining = this.signedAngleBetween(dir.x, dir.y, des.x, des.y);
          if (!isFinite(remaining)) return;

          const step =
            Math.sign(remaining) *
            Math.min(Math.abs(remaining), this.config.turnSpeed * event.dt);
          if (step === 0) return;

          // rotate current dir by 'step' (CCW positive)
          const x = dir.x,
            y = dir.y;
          const cs = Math.cos(step),
            sn = Math.sin(step);
          dir.set(cs * x - sn * y, sn * x + cs * y); // remains normalized
        },

        snapDirectionToDesired: () => {
          this._uDirection.value.copy(this.tmpDesiredDir);
        },

        // TSL uniforms are live; we centralize writes for clarity (no-op)
        writeUniforms: () => {},
        writeUniformsIdle: () => {},
      },
    },
  );

  // === Typed actor created from the typed machine ===
  private actor = createActor(this.machine).start();

  constructor(private folder: FolderApi) {
    this.folder = folder.addFolder({ title: "Wind" });

    // Optional live tuning
    this.folder.addBinding(this.config, "sleepTime", {
      min: 0,
      max: 5,
      step: 0.05,
    });
    this.folder.addBinding(this.config, "decayRate", {
      min: 0.1,
      max: 5,
      step: 0.1,
    });
    this.folder.addBinding(this.config, "riseRate", {
      min: 0.1,
      max: 5,
      step: 0.1,
    });
    this.folder.addBinding(this.config, "turnSpeed", {
      min: 0.1,
      max: 4,
      step: 0.05,
    });
    this.folder.addBinding(this.config, "holdTime", {
      min: 0,
      max: 5,
      step: 0.05,
    });

    // Drive the machine (your throttle)
    eventsManager.on("update-throttle-4x", ({ player, delta }) => {
      this.tickEvent.dt = delta;
      this.tickEvent.player.position = player.position;
      this.actor.send(this.tickEvent);
    });
  }

  // === Public: uniforms ===
  get uDirection() {
    return this._uDirection;
  }
  get uIntensity() {
    return this._uIntensity;
  }

  // === Public API ===
  registerTarget(label: string, position: Vector3, minR: number) {
    const id = `windTarget-${++this.idCounter}`;
    const target: WindTarget = {
      id,
      label,
      position,
      greenZoneSq: minR * minR,
    };
    this.targets.set(id, target);

    this.folder
      .addButton({ label: "Sway towards", title: label })
      .on("click", () => this.activateTarget(id));

    return id;
  }

  activateTarget(id: string) {
    this.actor.send({ type: "ACTIVATE_TARGET", id });
  }

  removeTarget(id: string) {
    this.actor.send({ type: "REMOVE_TARGET", id });
  }

  updateConfig(patch: Partial<WindStateConfig>) {
    this.actor.send({ type: "UPDATE_CONFIG", patch });
  }

  // === Helper: signed smallest angle using dot+cross ===
  private signedAngleBetween(
    cx: number,
    cy: number,
    dx: number,
    dy: number,
  ): number {
    // current = (cx, cy), desired = (dx, dy), both ~normalized
    const dot = cx * dx + cy * dy; // cos θ
    const cross = cx * dy - cy * dx; // sin θ (2D "z" of cross)
    return Math.atan2(cross, dot); // range [-π, π], CCW positive
  }

  // (kept for completeness, no longer used by guards)
  private remainingAngleToDesired(): number {
    const dir = this._uDirection.value;
    const des = this.tmpDesiredDir;
    return this.signedAngleBetween(dir.x, dir.y, des.x, des.y);
  }
}
