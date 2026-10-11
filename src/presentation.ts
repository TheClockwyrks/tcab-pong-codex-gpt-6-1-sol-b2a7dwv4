import type { DeepReadonly } from "ts-essentials";
import type { CaromState, Screen } from "./game";
import * as C from "./constants";
const mint = "#80f5d2",
  coral = "#ff8d83",
  gold = "#edc578",
  ink = "#e8eeec",
  muted = "#7b9299";
export function menuItems(screen: Screen): readonly string[] {
  switch (screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: DeepReadonly<CaromState>, index: number) {
  if (index < 0 || index >= menuItems(s.screen).length) return null;
  return {
    x: s.screen === "title" ? 100 : 450,
    y:
      (s.screen === "title" ? 385 : s.screen === "howto" ? 575 : 390) +
      index * 66,
    w: s.screen === "title" ? 350 : 380,
    h: 54,
  };
}
function text(
  ctx: CanvasRenderingContext2D,
  copy: string,
  x: number,
  y: number,
  size = 16,
  color = ink,
  weight = 400,
  align: CanvasTextAlign = "left",
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${size < 20 ? "monospace" : '"Arial", sans-serif'}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(copy, x, y);
}
function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  r = 6,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function line(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  x1: number,
  y1: number,
  color: string,
  width = 1,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function ball(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function furniture(s: DeepReadonly<CaromState>, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = "#294047";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 12]);
  ctx.beginPath();
  ctx.moveTo(C.NET_X, 100);
  ctx.lineTo(C.NET_X, C.FIELD_H - 60);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const side of ["left", "right"] as const) {
    const x = side === "left" ? C.P1_X0 : C.P2_X0,
      p = s.paddles[side],
      color = side === "left" ? mint : coral;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    bar(ctx, x, p.cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, color, 7);
    ctx.shadowBlur = 0;
  }
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    ctx.shadowColor = gold;
    ctx.shadowBlur = 15;
    bar(
      ctx,
      -C.OBSTACLE_HW,
      -C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      gold,
      8,
    );
    ctx.shadowBlur = 0;
    line(ctx, 0, -C.OBSTACLE_HH + 12, 0, C.OBSTACLE_HH - 12, "#fff2cf", 2);
    ball(ctx, 0, 0, 3, "#927143");
    ctx.restore();
  }
  if (s.ball) {
    const b = s.ball;
    for (let i = 1; i < b.trail.length; i++) {
      const a = b.trail[i - 1],
        p = b.trail[i];
      ctx.globalAlpha = (i / b.trail.length) * 0.45;
      line(ctx, a.x, a.y, p.x, p.y, mint, 2 + (i / b.trail.length) * 9);
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = mint;
    ctx.shadowBlur = 24;
    ball(ctx, b.x, b.y, C.BALL_R, ink);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
function menus(s: DeepReadonly<CaromState>, ctx: CanvasRenderingContext2D) {
  menuItems(s.screen).forEach((copy, i) => {
    const r = menuItemRect(s, i)!;
    const selected = i === s.menuIndex;
    bar(ctx, r.x, r.y, r.w, r.h, selected ? "#223e3e" : "#121f25", 8);
    ctx.strokeStyle = selected ? mint : "#26373e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.stroke();
    if (selected) bar(ctx, r.x, r.y + 15, 3, r.h - 30, mint, 1);
    text(ctx, copy, r.x + 24, r.y + r.h / 2, 18, selected ? mint : muted, 600);
    text(
      ctx,
      selected ? "↗" : String(i + 1).padStart(2, "0"),
      r.x + r.w - 25,
      r.y + r.h / 2,
      16,
      selected ? mint : "#46616a",
      400,
      "center",
    );
  });
}
function emblem(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(925, 320);
  ctx.strokeStyle = "#29474b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 210, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 161, 0, Math.PI * 2);
  ctx.stroke();
  line(ctx, -240, 0, 240, 0, "#1b3239");
  line(ctx, 0, -240, 0, 240, "#1b3239");
  ctx.setLineDash([4, 8]);
  ctx.strokeStyle = "#526c69";
  ctx.beginPath();
  ctx.moveTo(-193, 115);
  ctx.bezierCurveTo(-50, 180, -100, -180, 111, -93);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.rotate(-0.48);
  ctx.shadowColor = gold;
  ctx.shadowBlur = 24;
  bar(ctx, -55, -95, C.OBSTACLE_W, C.OBSTACLE_H, gold, 8);
  ctx.restore();
  ctx.save();
  ctx.rotate(-0.48);
  bar(ctx, 65, -20, C.OBSTACLE_W, C.OBSTACLE_H, gold, 8);
  ctx.restore();
  bar(ctx, -218, 65, C.PADDLE_W, C.PADDLE_H, mint, 7);
  bar(ctx, 202, -135, C.PADDLE_W, C.PADDLE_H, coral, 7);
  ctx.shadowColor = mint;
  ctx.shadowBlur = 28;
  ball(ctx, 111, -93, C.BALL_R, ink);
  ctx.restore();
}
export function draw(
  s: DeepReadonly<CaromState>,
  ctx: CanvasRenderingContext2D,
): void {
  ctx.save();
  const gradient = ctx.createRadialGradient(800, 330, 30, 640, 360, 760);
  gradient.addColorStop(0, "#14272d");
  gradient.addColorStop(1, "#0b1419");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  ctx.fillStyle = "#22363b";
  for (let x = 28; x < C.FIELD_W; x += 32)
    for (let y = 28; y < C.FIELD_H; y += 32) {
      ctx.globalAlpha = 0.36;
      ctx.fillRect(x, y, 1, 1);
    }
  ctx.globalAlpha = 1;
  line(ctx, 32, 32, C.FIELD_W - 32, 32, "#2c4146");
  line(ctx, 32, 688, C.FIELD_W - 32, 688, "#2c4146");
  if (s.screen === "title") {
    text(ctx, "C /", 58, 65, 23, mint, 700);
    text(ctx, "CAROM   /   PADDLE CLUB", 110, 65, 12, muted);
    text(ctx, "LOCAL PLAY • NO DOWNLOADS", 1222, 65, 12, muted, 400, "right");
    text(ctx, "A GAME OF ANGLES", 100, 177, 13, mint);
    text(ctx, C.TITLE_TEXT, 92, 263, 108, ink, 800);
    text(ctx, "Find your angle. Bend the rally.", 100, 344, 22, muted);
    menus(s, ctx);
    emblem(ctx);
    text(ctx, "01 /", 725, 583, 13, gold);
    text(ctx, "SPIN CHANGES EVERYTHING", 780, 583, 13, ink);
    text(
      ctx,
      "Move as you strike. Make the court your accomplice.",
      725,
      612,
      13,
      muted,
    );
    text(ctx, "W / S  or  ↑ / ↓   SELECT     ENTER  PLAY", 100, 651, 12, muted);
  } else {
    ctx.save();
    if (["howto", "paused", "matchover"].includes(s.screen))
      ctx.globalAlpha = 0.18;
    furniture(s, ctx);
    ctx.restore();
    text(ctx, C.TITLE_TEXT, 40, 65, 20, ink, 800);
    text(
      ctx,
      s.mode === "solo" ? "SOLO / HUMAN × MACHINE" : "VERSUS / LOCAL DUEL",
      40,
      90,
      11,
      muted,
    );
    text(
      ctx,
      String(s.score.p1).padStart(2, "0"),
      530,
      61,
      54,
      mint,
      700,
      "center",
    );
    text(ctx, ":", C.FIELD_CX, 60, 25, muted, 400, "center");
    text(
      ctx,
      String(s.score.p2).padStart(2, "0"),
      750,
      61,
      54,
      coral,
      700,
      "center",
    );
    text(
      ctx,
      "FIRST TO " + C.WIN_SCORE + " · WIN BY " + C.WIN_LEAD,
      C.FIELD_CX,
      110,
      11,
      muted,
      400,
      "center",
    );
    if (s.screen === "countdown") {
      text(ctx, "READY TO RALLY", C.FIELD_CX, 285, 13, mint, 500, "center");
      text(
        ctx,
        String(Math.max(1, Math.ceil(s.ball?.holdTimer ?? C.HOLD_TIME))),
        C.FIELD_CX,
        360,
        50,
        ink,
        700,
        "center",
      );
    }
    if (s.screen === "playing" || s.screen === "countdown") {
      text(
        ctx,
        s.mode === "solo" ? "W / S  OR  ↑ / ↓" : "PLAYER 01   W / S",
        100,
        651,
        12,
        mint,
      );
      text(
        ctx,
        s.mode === "solo" ? "AI OPPONENT" : "↑ / ↓   PLAYER 02",
        1180,
        651,
        12,
        coral,
        400,
        "right",
      );
    }
    if (s.screen === "paused" || s.screen === "matchover") {
      bar(ctx, 400, 180, 480, s.screen === "paused" ? 430 : 360, "#0d1b22", 16);
      text(
        ctx,
        s.screen === "paused" ? "TAKE A BREATHER" : "MATCH COMPLETE",
        640,
        231,
        12,
        mint,
        400,
        "center",
      );
      text(
        ctx,
        s.screen === "paused"
          ? "PAUSED"
          : s.winner === "left"
            ? "PLAYER 01 WINS"
            : s.mode === "solo"
              ? "AI WINS"
              : "PLAYER 02 WINS",
        640,
        295,
        s.screen === "paused" ? 56 : 36,
        ink,
        800,
        "center",
      );
      text(
        ctx,
        s.screen === "paused"
          ? "Your next angle can wait."
          : `${s.score.p1}  —  ${s.score.p2}   /   Well played.`,
        640,
        346,
        16,
        muted,
        400,
        "center",
      );
      menus(s, ctx);
    }
    if (s.screen === "howto") {
      bar(ctx, 190, 151, 900, 488, "#0e1d24", 16);
      text(ctx, "THE ART OF THE RETURN", 640, 197, 12, mint, 400, "center");
      text(ctx, "HOW TO PLAY", 640, 249, 46, ink, 800, "center");
      const lessons = [
        [
          "01",
          "OWN YOUR SIDE",
          "W / S moves the left paddle. ↑ / ↓ moves the right.",
          "In Solo, either pair controls you. The AI takes the right.",
        ],
        [
          "02",
          "PUT A LITTLE SPIN ON IT",
          "Move your paddle as the ball hits to curve its flight.",
          "A still paddle aims with the point of contact.",
        ],
        [
          "03",
          "PLAY THE ANGLES",
          "The gold bars sway and rotate. Bank off their faces.",
          "Score past your opponent. First to " +
            C.WIN_SCORE +
            ", leading by " +
            C.WIN_LEAD +
            ".",
        ],
      ];
      lessons.forEach(([n, heading, a, b], i) => {
        const y = 326 + i * 78;
        text(ctx, n, 231, y, 15, gold);
        text(ctx, heading, 278, y, 16, ink, 700);
        text(ctx, a, 278, y + 25, 13, muted);
        text(ctx, b, 278, y + 44, 13, muted);
      });
      menus(s, ctx);
    }
  }
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    1222,
    s.screen === "title" ? 651 : 65,
    12,
    muted,
    400,
    "right",
  );
  if (s.screen !== "title")
    text(ctx, "P / ESC  PAUSE", 640, 651, 12, muted, 400, "center");
  text(ctx, "PRECISION / MOMENTUM / MISCHIEF", 100, 705, 10, "#526c73");
  text(
    ctx,
    "A PADDLE DUEL WITH A TWIST",
    1180,
    705,
    10,
    "#526c73",
    400,
    "right",
  );
  ctx.restore();
}
