import type { Game } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { advanceWorld, parkedBall, obstaclePose } from "./simulation";
import { draw, menuItems, menuItemRect } from "./presentation";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";
export type Mode = "solo" | "versus";
export type Side = "left" | "right";
export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}
export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}
export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}
export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}
export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly theta: number;
}
export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";
  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;
  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;
  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly obstacleClock: number;
  readonly obstacleClockRunning: boolean;
  readonly simTime: number;
  readonly muted: boolean;
  // Input bookkeeping: a menu gesture's landing region, never simulation data.
  readonly menuPresses?: Readonly<Record<number, number>>;
}
type State = DeepReadonly<CaromState>;
export const BACKGROUND = "#0b1419";
const paddle = (): PaddleState => ({
  cy: C.FIELD_CY,
  vy: 0,
  driven: false,
  drivenVy: 0,
});
function initial(muted = false): CaromState {
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: paddle(), right: paddle() },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parkedBall(),
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstaclePose(i, 0)),
    obstacleClock: 0,
    obstacleClockRunning: true,
    simTime: 0,
    muted,
  };
}
function title(s: State): CaromState {
  return {
    ...initial(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
function start(s: State, mode: Mode): CaromState {
  return {
    ...s,
    screen: "countdown",
    mode,
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: parkedBall(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
    obstacleClock: 0,
    obstacleClockRunning: true,
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstaclePose(i, 0)),
    menuPresses: {},
  };
}
function confirm(s: State): CaromState {
  switch (s.screen) {
    case "title": {
      const next = { ...s, titleIndex: s.menuIndex };
      return s.menuIndex === 2
        ? { ...next, screen: "howto", menuIndex: 0 }
        : start(next, s.menuIndex === 0 ? "solo" : "versus");
    }
    case "howto":
      return title(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen }
        : s.menuIndex === 1
          ? start(s, s.mode)
          : title(s);
    case "matchover":
      return s.menuIndex === 0 ? start(s, s.mode) : title(s);
    default:
      return { ...s };
  }
}
function patchBall(s: State, values: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("Carom: no ball present");
  return { ...s, ball: { ...s.ball, ...values } };
}
function patchPaddle(
  s: State,
  side: Side,
  values: Partial<PaddleState>,
): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...values } },
  };
}
function snapshot(s: State) {
  const { menuPresses: _presses, ...declared } = s;
  return {
    ...structuredClone(declared),
    version: C.CAROM_DEBUG_VERSION,
    ball: s.ball
      ? { ...structuredClone(s.ball), speed: Math.hypot(s.ball.vx, s.ball.vy) }
      : null,
  };
}
const debug = {
  version: C.CAROM_DEBUG_VERSION,
  snapshot,
  menuItemRect,
  clearWorld: (s: State): CaromState => ({ ...s, ball: null, obstacles: [] }),
  spawnBall: (s: State): CaromState => ({ ...s, ball: parkedBall() }),
  spawnObstacle: (s: State, index: number): CaromState => {
    if (!C.OBSTACLE_CENTERS[index])
      throw new Error("Carom: invalid obstacle index");
    return {
      ...s,
      obstacles: [
        ...s.obstacles.filter((o) => o.index !== index),
        obstaclePose(index, s.obstacleClock),
      ].sort((a, b) => a.index - b.index),
    };
  },
  reset: (s: State) => initial(s.muted),
  reconcile: (s: State): CaromState => ({
    ...s,
    obstacles: s.obstacles.map((o) => obstaclePose(o.index, s.obstacleClock)),
  }),
  setScreen: (s: State, screen: Screen): CaromState => ({ ...s, screen }),
  setMode: (s: State, mode: Mode): CaromState => ({ ...s, mode }),
  setMenuIndex: (s: State, menuIndex: number): CaromState => ({
    ...s,
    menuIndex,
  }),
  setTitleIndex: (s: State, titleIndex: number): CaromState => ({
    ...s,
    titleIndex,
  }),
  setResumeScreen: (
    s: State,
    resumeScreen: "countdown" | "playing",
  ): CaromState => ({ ...s, resumeScreen }),
  setScore: (s: State, p1: number, p2: number): CaromState => ({
    ...s,
    score: { p1, p2 },
  }),
  setWinner: (s: State, winner: Side | null): CaromState => ({ ...s, winner }),
  setReceiver: (s: State, receiver: Side): CaromState => ({ ...s, receiver }),
  setPaddleCy: (s: State, side: Side, cy: number) =>
    patchPaddle(s, side, { cy }),
  setPaddleVy: (s: State, side: Side, drivenVy: number) =>
    patchPaddle(s, side, { drivenVy }),
  setPaddleDriven: (s: State, side: Side, driven: boolean) =>
    patchPaddle(s, side, { driven }),
  setBallPosition: (s: State, x: number, y: number) => patchBall(s, { x, y }),
  setBallVelocity: (s: State, vx: number, vy: number) =>
    patchBall(s, { vx, vy }),
  setBallSpin: (s: State, spin: number) => patchBall(s, { spin }),
  setBallHeld: (s: State, held: boolean) => patchBall(s, { held }),
  setBallHoldTimer: (s: State, holdTimer: number) =>
    patchBall(s, { holdTimer }),
  setBallServeSign: (s: State, serveSign: 1 | -1) =>
    patchBall(s, { serveSign }),
  drawBallServeSign: (s: State) =>
    patchBall(s, { serveSign: Math.random() < 0.5 ? -1 : 1 }),
  setAiTracking: (s: State, tracking: boolean): CaromState => ({
    ...s,
    ai: { ...s.ai, tracking },
  }),
  setAiMovement: (s: State, movement: boolean): CaromState => ({
    ...s,
    ai: { ...s.ai, movement },
  }),
  setMuted: (s: State, muted: boolean): CaromState => ({ ...s, muted }),
  setObstacleClock: (s: State, obstacleClock: number): CaromState => ({
    ...s,
    obstacleClock,
    obstacles: s.obstacles.map((o) => obstaclePose(o.index, obstacleClock)),
  }),
  setObstacleClockRunning: (
    s: State,
    obstacleClockRunning: boolean,
  ): CaromState => ({ ...s, obstacleClockRunning }),
};
export type CaromDebugApi = typeof debug;
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    const sounds = [
      { freq: 640, freqTo: 340, durationMs: 65, wave: "sine" as const },
      { freq: 260, durationMs: 45, wave: "triangle" as const },
      { freq: 850, freqTo: 460, durationMs: 95, wave: "triangle" as const },
      { freq: 420, freqTo: 840, durationMs: 220, wave: "sine" as const },
    ];
    Object.values(C.CUES).forEach((name, i) =>
      api.audio.define(name, { ...sounds[i], gain: 0.12 }),
    );
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("score", (s) => `${s.score.p1} : ${s.score.p2}`);
    for (const side of ["left", "right"] as const)
      api.diagnostics.register(
        side,
        (s) =>
          `y ${s.paddles[side].cy.toFixed(1)} / vy ${s.paddles[side].vy.toFixed(1)}`,
      );
    for (const key of ["x", "y", "vx", "vy", "spin"] as const)
      api.diagnostics.register(`ball ${key}`, (s) => s.ball?.[key] ?? "none");
    api.diagnostics.register("ball speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "none",
    );
    return [initial(), debug];
  },
  update(state, api, dt) {
    const edges = Object.fromEntries(
      C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
    );
    const held = Object.fromEntries(
      C.ACTIONS.map((a) => [a, api.input.value(a)]),
    );
    const samples = api.input.pointerSamples();
    const contacts = api.input.pointerContacts();
    api.input.pointer();
    api.audio.setMuted(state.muted);
    if (edges.mute) api.audio.setMuted(!api.audio.muted());
    let s: CaromState = {
      ...state,
      simTime: state.simTime + dt,
      muted: api.audio.muted(),
    };
    let keyboardConfirm = false;
    if (
      (state.screen === "playing" || state.screen === "countdown") &&
      edges.pause
    )
      s = { ...s, screen: "paused", resumeScreen: state.screen, menuIndex: 0 };
    else if (state.screen === "paused" && (edges.pause || edges.back))
      s = { ...s, screen: state.resumeScreen };
    else if (
      (state.screen === "howto" || state.screen === "matchover") &&
      edges.back
    )
      s = title(s);
    else if (menuItems(state.screen).length) {
      const up = edges["p1-up"] || edges["p2-up"],
        down = edges["p1-down"] || edges["p2-down"];
      if (up || down)
        s = {
          ...s,
          menuIndex:
            (s.menuIndex + (up ? -1 : 1) + menuItems(s.screen).length) %
            menuItems(s.screen).length,
        };
      else if (edges.confirm) {
        s = confirm(s);
        keyboardConfirm = true;
      }
      if (!keyboardConfirm) {
        const presses = { ...state.menuPresses };
        const hit = (x: number, y: number) =>
          menuItems(state.screen).findIndex((_, i) => {
            const r = menuItemRect(state, i);
            return (
              r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
            );
          });
        let click = -1;
        for (const sample of samples) {
          if (sample.button && sample.button !== "primary") continue;
          const i = hit(sample.x, sample.y);
          if (i >= 0) s = { ...s, menuIndex: i };
          if (sample.type === "down") presses[sample.id] = i;
          if (sample.type === "up") {
            if (i >= 0 && presses[sample.id] === i) click = i;
            delete presses[sample.id];
          }
        }
        for (const contact of contacts) {
          const i = hit(contact.x, contact.y);
          if (i >= 0) s = { ...s, menuIndex: i };
        }
        s = { ...s, menuPresses: presses };
        if (click >= 0) s = confirm({ ...s, menuIndex: click });
      }
    }
    if (s.screen === "playing" || s.screen === "countdown")
      s = advanceWorld(s, held, dt, api.audio.play);
    return s;
  },
  render(s, api) {
    draw(s, api.ctx);
  },
};
