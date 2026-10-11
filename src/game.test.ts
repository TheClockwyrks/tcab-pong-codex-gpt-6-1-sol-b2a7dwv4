import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { BACKGROUND, game } from "./game";
import * as C from "./constants";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn());
});
async function setup(ms = 16, render = true) {
  const target = new EventTarget();
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    background: BACKGROUND,
    game: render ? game : { ...game, render: () => {} },
    layout: C.LAYOUT,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  await engine.initialize();
  cleanups.push(() => engine.destroy());
  const key = (code: string, type = "keydown") => {
    const e = new Event(type);
    Object.assign(e, { code, repeat: false });
    target.dispatchEvent(e);
  };
  const press = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, "keyup");
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) => {
    const e = new Event("pointer" + type);
    Object.assign(e, {
      clientX: x,
      clientY: y,
      pointerId: id,
      pointerType: device,
      isPrimary: id === 1,
      button: 0,
      buttons: type === "up" ? 0 : 1,
    });
    target.dispatchEvent(e);
  };
  const flight = (x: number, y: number, vx: number, vy: number) => {
    const d = engine.debug;
    engine.apply((s) =>
      d.setBallVelocity(
        d.setBallPosition(
          d.setBallHeld(
            d.spawnBall(d.setScreen(d.clearWorld(s), "playing")),
            false,
          ),
          x,
          y,
        ),
        vx,
        vy,
      ),
    );
  };
  return { engine, key, press, pointer, flight };
}
describe("Carom through the engine", () => {
  it("initializes the complete title state and pure diagnostic reads", async () => {
    const { engine } = await setup();
    const before = engine.debug.snapshot(engine.state);
    expect(before.screen).toBe("title");
    expect(before.obstacles).toHaveLength(2);
    expect(before.ball?.held).toBe(true);
    expect(before.ball?.speed).toBe(0);
    expect(engine.diagnostics().length).toBeGreaterThanOrEqual(11);
    expect(engine.debug.snapshot(engine.state)).toEqual(before);
    engine.apply((s) => engine.debug.reconcile(s));
    expect(engine.debug.snapshot(engine.state)).toEqual(before);
  });
  it("navigates with edge priorities, remembers the title item, and restores title state", async () => {
    const { engine, key, press } = await setup();
    key("ArrowDown");
    key("Enter");
    await engine.advance(1);
    key("ArrowDown", "keyup");
    key("Enter", "keyup");
    expect(engine.state.menuIndex).toBe(1);
    expect(engine.state.screen).toBe("title");
    await press("Enter");
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.titleIndex).toBe(1);
    await press("Escape");
    expect(engine.state.screen).toBe("paused");
    await press("ArrowUp");
    expect(engine.state.menuIndex).toBe(2);
    await press("Enter");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
  });
  it("serves the posed sign on the elapsed hold frame without moving the ball", async () => {
    const { engine } = await setup(10);
    const d = engine.debug;
    engine.apply((s) =>
      d.setBallServeSign(
        d.setBallHoldTimer(d.setScreen(s, "countdown"), 0.02),
        -1,
      ),
    );
    await engine.advance(1);
    expect(engine.state.ball?.held).toBe(true);
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.ball?.x).toBe(C.FIELD_CX);
    expect(engine.state.ball?.vy).toBeCloseTo(
      -C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
    );
    await engine.advance(1);
    expect(engine.state.ball!.x).toBeLessThan(C.FIELD_CX);
  });
  it("moves human and driven paddles during holds, clamps actual velocity, and freezes on pause", async () => {
    const { engine, key, press } = await setup(10);
    await press("Enter");
    key("ArrowDown");
    await engine.advance(10);
    expect(engine.state.paddles.left.cy).toBeCloseTo(
      C.FIELD_CY + C.PADDLE_SPEED * 0.1,
    );
    key("ArrowDown", "keyup");
    const d = engine.debug;
    engine.apply((s) =>
      d.setPaddleVy(
        d.setPaddleDriven(
          d.setPaddleCy(s, "left", C.PADDLE_MAX_CY),
          "left",
          true,
        ),
        "left",
        300,
      ),
    );
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(0);
    expect(engine.state.paddles.left.drivenVy).toBe(300);
    await press("Escape");
    const ball = engine.state.ball,
      clock = engine.state.obstacleClock,
      time = engine.state.simTime;
    await engine.advance(20);
    expect(engine.state.ball).toEqual(ball);
    expect(engine.state.obstacleClock).toBe(clock);
    expect(engine.state.simTime).toBeCloseTo(time + 0.2);
    await press("Escape");
    expect(engine.state.screen).toBe("countdown");
  });
  it("requires pointer landing and release inside the same item across frames", async () => {
    const { engine, pointer } = await setup();
    const r = engine.debug.menuItemRect(engine.state, 1)!;
    pointer("down", r.x + 20, r.y + 20);
    await engine.advance(1);
    pointer("up", r.x + 20, r.y + 90);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    pointer("down", r.x + 20, r.y + 20);
    await engine.advance(1);
    pointer("up", r.x + 20, r.y + 20);
    await engine.advance(1);
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.screen).toBe("countdown");
  });
  it("accepts touch taps and draws the instructions and every menu", async () => {
    const { engine, pointer, press } = await setup();
    const r = engine.debug.menuItemRect(engine.state, 2)!;
    pointer("down", r.x + 20, r.y + 20, 2, "touch");
    pointer("up", r.x + 20, r.y + 20, 2, "touch");
    await engine.advance(1);
    expect(engine.state.screen).toBe("howto");
    await press("Escape");
    await press("ArrowDown");
    await press("Enter");
    await press("KeyP");
    await press("ArrowDown");
    await press("Enter");
    expect(engine.state.screen).toBe("countdown");
    engine.apply((s) => engine.debug.setScreen(s, "matchover"));
    await engine.advance(1);
    await press("Enter");
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
  });
  it("bounces off paddle faces, accelerates, adds motion spin, and deduplicates cues", async () => {
    const { engine, flight } = await setup(16);
    flight(85, 360, -C.SERVE_SPEED, 0);
    const d = engine.debug;
    engine.apply((s) =>
      d.setPaddleVy(d.setPaddleDriven(s, "left", true), "left", 200),
    );
    const cues: string[] = [];
    engine.events.on("cue:played", (e) => cues.push(e.cue));
    await engine.advance(2);
    expect(engine.state.ball!.vx).toBeGreaterThan(0);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(C.SERVE_SPEED * C.SPEED_MULT);
    expect(engine.state.ball!.spin).toBeGreaterThan(0);
    expect(cues).toEqual([C.CUES.paddleHit]);
  });
  it("reflects walls and paddle end caps without changing speed", async () => {
    const { engine, flight } = await setup(10);
    flight(200, 12, 0, -600);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(600);
    flight(C.P1_X0 + 5, C.FIELD_CY - C.PADDLE_HALF - C.BALL_R + 1, 0, 600);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(-600);
    expect(engine.state.ball!.y).toBeLessThan(C.FIELD_CY - C.PADDLE_HALF);
  });
  it("reflects a rotated obstacle and preserves speed and spin", async () => {
    const { engine, flight } = await setup(2);
    const d = engine.debug;
    flight(490 + 16, 220, -520, 0);
    engine.apply((s) =>
      d.spawnObstacle(d.setObstacleClockRunning(s, false), 0),
    );
    await engine.advance(1);
    expect(engine.state.ball!.vx).toBeGreaterThan(0);
    expect(engine.state.ball!.vx).toBeCloseTo(520);
    engine.apply((s) => d.setObstacleClock(s, 0.75));
    const o = engine.state.obstacles[0],
      nx = Math.cos(o.theta),
      ny = Math.sin(o.theta);
    engine.apply((s) =>
      d.setBallVelocity(
        d.setBallPosition(s, o.cx + nx * 20, o.cy + ny * 20),
        -520 * nx,
        -520 * ny,
      ),
    );
    await engine.advance(1);
    expect(engine.state.ball!.vx).toBeCloseTo(520 * nx);
    expect(engine.state.ball!.vy).toBeCloseTo(520 * ny);
  });
  it("turns velocity with spin, decays it by elapsed time, and bounds the trail", async () => {
    const { engine, flight } = await setup(10);
    flight(640, 360, 520, 0);
    engine.apply((s) => engine.debug.setBallSpin(s, 600));
    await engine.advance(80);
    expect(engine.state.ball!.spin).toBeCloseTo(300);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(520);
    expect(engine.state.ball!.vy).toBeGreaterThan(0);
    expect(
      engine.state.ball!.trail.every(
        (p) => engine.state.simTime - p.t <= C.TRAIL_TIME,
      ),
    ).toBe(true);
  });
  it("scores toward the receiver, continues at deuce, and wins by two", async () => {
    const { engine, flight } = await setup();
    const d = engine.debug;
    flight(C.FIELD_W + C.BALL_R + 1, 360, 520, 0);
    engine.apply((s) => d.setScore(s, 10, 10));
    await engine.advance(1);
    expect(engine.state.score).toEqual({ p1: 11, p2: 10 });
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.receiver).toBe("right");
    expect(engine.state.ball!.spin).toBe(0);
    flight(C.FIELD_W + C.BALL_R + 1, 360, 520, 0);
    await engine.advance(1);
    expect(engine.state.winner).toBe("left");
    expect(engine.state.screen).toBe("matchover");
    expect(engine.state.ball!.x).toBeGreaterThan(C.FIELD_W);
  });
  it("requires the scorer to lead even when scores are posed out of normal play", async () => {
    const { engine, flight } = await setup();
    flight(C.FIELD_W + C.BALL_R + 1, 360, 520, 0);
    engine.apply((s) => engine.debug.setScore(s, 11, 14));
    await engine.advance(1);
    expect(engine.state.score).toEqual({ p1: 12, p2: 14 });
    expect(engine.state.winner).toBeNull();
    expect(engine.state.screen).toBe("countdown");
  });
  it("gates AI sensing and movement independently", async () => {
    const { engine, flight } = await setup(10);
    flight(640, 500, 520, 0);
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    const d = engine.debug;
    engine.apply((s) => d.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
    engine.apply((s) =>
      d.setAiTracking(
        d.setAiMovement(d.setPaddleCy(s, "right", 500), true),
        false,
      ),
    );
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
  });
  it("poses, removes, reconciles, and resets world entities without mutating previous values", async () => {
    const { engine } = await setup();
    const d = engine.debug,
      old = engine.state;
    engine.apply((s) => d.setObstacleClock(s, 1.2));
    expect(old.obstacleClock).toBe(0);
    expect(engine.state.obstacles[0].theta).toBe(C.OBSTACLE_SPIN_RATE * 1.2);
    engine.apply((s) => d.clearWorld(s));
    expect(() => d.setBallSpin(engine.state, 1)).toThrow();
    expect(() => d.spawnObstacle(engine.state, 2)).toThrow();
    engine.apply((s) => d.spawnObstacle(s, 1));
    expect(engine.state.obstacles.map((o) => o.index)).toEqual([1]);
    engine.apply((s) => d.setScreen(s, "playing"));
    await engine.advance(1);
    expect(engine.state.ball).toBeNull();
    engine.apply((s) => d.reset(s));
    expect(engine.state.simTime).toBe(0);
    expect(engine.state.obstacles).toHaveLength(2);
  });
  it("toggles mute from a menu and through a debug pose", async () => {
    const { engine, press } = await setup();
    await press("KeyM");
    expect(engine.state.muted).toBe(true);
    engine.apply((s) => engine.debug.setMuted(s, false));
    await engine.advance(1);
    expect(engine.state.muted).toBe(false);
  });
  it("agrees on contacts, speed and scoring at 2ms and 16ms steps", async () => {
    const run = async (ms: number) => {
      const { engine, flight } = await setup(ms, false);
      flight(700, 350, -600, -180);
      const events: string[] = [];
      engine.events.on("cue:played", (e) => events.push(e.cue));
      await engine.advance(4000 / ms);
      return { events, state: engine.debug.snapshot(engine.state) };
    };
    const a = await run(2),
      b = await run(16);
    expect(a.events).toEqual(b.events);
    expect(a.state.score).toEqual(b.state.score);
    expect(Math.abs(a.state.ball!.speed - b.state.ball!.speed)).toBeLessThan(
      10,
    );
  });
});
