import nipplejs from "nipplejs";

class KeyboardManager {
  private keysPressed: Set<string>;
  private keyDownListeners: Map<string, VoidFunction>;
  private keyUpListeners: Map<string, VoidFunction>;

  constructor() {
    this.keysPressed = new Set();
    this.keyDownListeners = new Map();
    this.keyUpListeners = new Map();

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  private handleKeyDown(event: KeyboardEvent) {
    const code = event.code;
    if (!this.keysPressed.has(code)) {
      this.keysPressed.add(code);
      this.keyDownListeners.get(code)?.();
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    const code = event.code;
    this.keysPressed.delete(code);
    this.keyUpListeners.get(code)?.();
  }

  isKeyPressed(code: string): boolean {
    if (code === "*") return this.keysPressed.size > 0;
    return this.keysPressed.has(code);
  }

  onKeyDown(code: string, callback: VoidFunction) {
    this.keyDownListeners.set(code, callback);
  }

  onKeyUp(code: string, callback: VoidFunction) {
    this.keyUpListeners.set(code, callback);
  }

  dispose() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }
}

const keyboardManager = new KeyboardManager();

class JoystickManager {
  private isActive = false;
  private direction: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    const zone = document.createElement("div");
    zone.classList.add("joystick-zone");
    document.body.appendChild(zone);

    const joystick = nipplejs.create({
      zone,
      mode: "static",
      position: { left: "50%", top: "50%" },
      restOpacity: 0.1,
      size: 100,
      threshold: 0.2,
    });

    joystick.on("start", () => {
      this.isActive = true;
    });

    joystick.on("move", (_, data) => {
      if (!data?.vector) return;
      this.direction = { x: data.vector.x, y: data.vector.y };
    });

    joystick.on("end", () => {
      this.isActive = false;
      this.direction = { x: 0, y: 0 };
    });
  }

  private readonly threshold = 0.2;

  isForward(): boolean {
    return this.isActive && this.direction.y > -this.threshold;
  }

  isBackward(): boolean {
    return this.isActive && this.direction.y < this.threshold;
  }

  isLeftward(): boolean {
    return this.isActive && this.direction.x < -this.threshold;
  }

  isRightward(): boolean {
    return this.isActive && this.direction.x > this.threshold;
  }
}

const joystickManager = new JoystickManager();

class InputManager {
  isForward(): boolean {
    return (
      keyboardManager.isKeyPressed("KeyW") ||
      keyboardManager.isKeyPressed("ArrowUp") ||
      joystickManager.isForward()
    );
  }

  isBackward(): boolean {
    return (
      keyboardManager.isKeyPressed("KeyS") ||
      keyboardManager.isKeyPressed("ArrowDown") ||
      joystickManager.isBackward()
    );
  }

  isLeftward(): boolean {
    return (
      keyboardManager.isKeyPressed("KeyA") ||
      keyboardManager.isKeyPressed("ArrowLeft") ||
      joystickManager.isLeftward()
    );
  }

  isRightward(): boolean {
    return (
      keyboardManager.isKeyPressed("KeyD") ||
      keyboardManager.isKeyPressed("ArrowRight") ||
      joystickManager.isRightward()
    );
  }

  isJumpPressed(): boolean {
    return keyboardManager.isKeyPressed("Space");
  }
}

export const inputManager = new InputManager();
