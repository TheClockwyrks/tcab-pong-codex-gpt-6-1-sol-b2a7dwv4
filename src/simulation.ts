import * as C from "./constants";
import type { BallState, CaromState, ObstacleState, PaddleState } from "./game";
export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
export function parkedBall(): BallState {
  return {
    x: C.FIELD_CX,
    y: C.FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: C.HOLD_TIME,
    serveSign: Math.random() < 0.5 ? -1 : 1,
    trail: [],
  };
}
export function obstaclePose(index: number, t: number): ObstacleState {
  const base = C.OBSTACLE_CENTERS[index];
  return {
    index,
    cx: base.x,
    cy:
      base.y +
      (index === 0 ? 1 : -1) *
        C.OBSTACLE_SWAY_AMP *
        Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    theta: C.OBSTACLE_SPIN_RATE * t,
  };
}
function move(p: PaddleState, vy: number, dt: number): PaddleState {
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : vy };
}
export function advanceWorld(
  s: CaromState,
  held: Record<string, number>,
  dt: number,
  play: (cue: string) => void,
): CaromState {
  const axis = (up: boolean, down: boolean) =>
    (Number(down) - Number(up)) * C.PADDLE_SPEED;
  const leftVy = axis(
    !!held["p1-up"] || (s.mode === "solo" && !!held["p2-up"]),
    !!held["p1-down"] || (s.mode === "solo" && !!held["p2-down"]),
  );
  let rightVy = axis(!!held["p2-up"], !!held["p2-down"]);
  if (s.mode === "solo") {
    let target = C.AI_HOME_Y,
      deadzone = C.AI_HOME_DEADZONE;
    if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
      target = s.ball.y - s.ball.vy * C.AI_REACT;
      deadzone = C.AI_DEADZONE;
    }
    const diff = target - s.paddles.right.cy;
    rightVy =
      s.ai.movement && Math.abs(diff) > deadzone && dt > 0
        ? Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt)
        : 0;
  }
  const paddles = {
    left: move(
      s.paddles.left,
      s.paddles.left.driven ? s.paddles.left.drivenVy : leftVy,
      dt,
    ),
    right: move(
      s.paddles.right,
      s.paddles.right.driven ? s.paddles.right.drivenVy : rightVy,
      dt,
    ),
  };
  const cues = new Set<string>();
  let next: CaromState = { ...s, paddles };
  if (s.ball) {
    let b = { ...s.ball };
    if (b.held) {
      b = { ...b, holdTimer: Math.max(0, b.holdTimer - dt) };
      if (b.holdTimer <= 0) {
        b = {
          ...b,
          held: false,
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
          trail: [],
        };
        next = { ...next, screen: "playing" };
      }
    } else if (s.screen === "playing") {
      const n = Math.max(
          1,
          Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
        ),
        h = dt / n;
      for (let i = 0; i < n; i++) {
        const speed = Math.hypot(b.vx, b.vy),
          angle = speed > 0 ? (b.spin / speed) * h : 0,
          cos = Math.cos(angle),
          sin = Math.sin(angle);
        const vx = b.vx * cos - b.vy * sin,
          vy = b.vx * sin + b.vy * cos;
        b = {
          ...b,
          vx,
          vy,
          spin: b.spin * Math.pow(0.5, h / C.SPIN_HALFLIFE),
          x: b.x + vx * h,
          y: b.y + vy * h,
        };
        if (b.y < C.BALL_R && b.vy < 0) {
          b.y = C.BALL_R;
          b.vy = -b.vy;
          cues.add(C.CUES.wallBounce);
        } else if (b.y > C.FIELD_H - C.BALL_R && b.vy > 0) {
          b.y = C.FIELD_H - C.BALL_R;
          b.vy = -b.vy;
          cues.add(C.CUES.wallBounce);
        }
        for (const side of ["left", "right"] as const) {
          const p = paddles[side],
            x0 = side === "left" ? C.P1_X0 : C.P2_X0,
            x1 = side === "left" ? C.P1_X1 : C.P2_X1,
            y0 = p.cy - C.PADDLE_HALF,
            y1 = p.cy + C.PADDLE_HALF;
          const depths = [
            b.x - (x0 - C.BALL_R),
            x1 + C.BALL_R - b.x,
            b.y - (y0 - C.BALL_R),
            y1 + C.BALL_R - b.y,
          ];
          if (depths.every((v) => v > 0)) {
            const face = depths.indexOf(Math.min(...depths));
            if (face < 2) {
              const entering = face === 0 ? b.vx > 0 : b.vx < 0;
              b.x = face === 0 ? x0 - C.BALL_R : x1 + C.BALL_R;
              if (entering) {
                const theta =
                    clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) *
                    C.MAX_BOUNCE_ANGLE,
                  sp = Math.min(
                    Math.hypot(b.vx, b.vy) * C.SPEED_MULT,
                    C.SPEED_CAP,
                  );
                b.vx = (side === "left" ? 1 : -1) * sp * Math.cos(theta);
                b.vy = sp * Math.sin(theta);
                b.spin = clamp(
                  b.spin + p.vy * C.SPIN_FROM_PADDLE,
                  -C.SPIN_CLAMP,
                  C.SPIN_CLAMP,
                );
                b.x = side === "left" ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
                cues.add(C.CUES.paddleHit);
              }
            } else {
              b.y = face === 2 ? y0 - C.BALL_R : y1 + C.BALL_R;
              if (face === 2 ? b.vy > 0 : b.vy < 0) {
                b.vy = -b.vy;
                cues.add(C.CUES.wallBounce);
              }
            }
          }
        }
        for (const o of s.obstacles) {
          const co = Math.cos(o.theta),
            si = Math.sin(o.theta),
            dx = b.x - o.cx,
            dy = b.y - o.cy,
            lx = dx * co + dy * si,
            ly = -dx * si + dy * co,
            qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW),
            qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH),
            dist = Math.hypot(lx - qx, ly - qy);
          if (dist < C.BALL_R) {
            let nx: number, ny: number, push: number;
            if (dist > 0) {
              nx = (lx - qx) / dist;
              ny = (ly - qy) / dist;
              push = C.BALL_R - dist;
            } else {
              const px = C.OBSTACLE_HW - Math.abs(lx),
                py = C.OBSTACLE_HH - Math.abs(ly);
              nx = px <= py ? (lx >= 0 ? 1 : -1) : 0;
              ny = px <= py ? 0 : ly >= 0 ? 1 : -1;
              push = C.BALL_R + Math.min(px, py);
            }
            const wx = nx * co - ny * si,
              wy = nx * si + ny * co,
              dot = b.vx * wx + b.vy * wy;
            if (dot < 0) {
              b.vx -= 2 * dot * wx;
              b.vy -= 2 * dot * wy;
              cues.add(C.CUES.obstacleBounce);
            }
            b.x += wx * push;
            b.y += wy * push;
          }
        }
      }
      if (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0) {
        const left = b.x > C.FIELD_W,
          score = {
            p1: s.score.p1 + Number(left),
            p2: s.score.p2 + Number(!left),
          };
        cues.add(C.CUES.score);
        if (
          (left ? score.p1 : score.p2) >= C.WIN_SCORE &&
          (left ? score.p1 - score.p2 : score.p2 - score.p1) >= C.WIN_LEAD
        )
          next = {
            ...next,
            score,
            winner: left ? "left" : "right",
            screen: "matchover",
            menuIndex: 0,
          };
        else {
          next = {
            ...next,
            score,
            receiver: left ? "right" : "left",
            screen: "countdown",
          };
          b = { ...parkedBall() };
        }
      }
    }
    b = {
      ...b,
      trail: [...b.trail, { x: b.x, y: b.y, t: s.simTime }].filter(
        (p) => s.simTime - p.t <= C.TRAIL_TIME,
      ),
    };
    next = { ...next, ball: b };
  }
  const obstacleClock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  for (const cue of cues) play(cue);
  return {
    ...next,
    obstacleClock,
    obstacles: s.obstacles.map((o) => obstaclePose(o.index, obstacleClock)),
  };
}
