import "./style.css";
import PhysicsManager from "./systems/PhysicsManager";
import Game from "./Game";

const physicsManager = new PhysicsManager();

physicsManager.init().then(() => {
  const game = new Game();
  game.startLoop();
});
