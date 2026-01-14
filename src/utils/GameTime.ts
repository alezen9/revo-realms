import { uniform } from "three/tsl";

export const gameTime = uniform(0);
export const gameDeltaTime = uniform(0);

export const GameTime = {
  timeSeconds: 0,
  deltaSeconds: 0,
  reset() {
    this.timeSeconds = 0;
    this.deltaSeconds = 0;
    gameTime.value = 0;
    gameDeltaTime.value = 0;
  },
  update(deltaSeconds: number) {
    this.deltaSeconds = deltaSeconds;
    this.timeSeconds += deltaSeconds;
    gameDeltaTime.value = deltaSeconds;
    gameTime.value = this.timeSeconds;
  },
};
