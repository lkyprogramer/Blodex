import { describe, expect, it } from "vitest";
import { resolveAiStateForDistance } from "../aiBehavior";

describe("ai behavior", () => {
  it("switches chase monsters to attack in range", () => {
    const state = resolveAiStateForDistance({
      behavior: "chase",
      distance: 1.1,
      attackRange: 1,
      chaseRange: 7
    });
    expect(state).toBe("attack");
  });

  it("keeps kite monsters retreating when too close", () => {
    const state = resolveAiStateForDistance({
      behavior: "kite",
      distance: 2.8,
      attackRange: 1.6,
      chaseRange: 8,
      preferredDistance: 5
    });
    expect(state).toBe("kite");
  });

  it("keeps ambush monsters hidden before ambush radius", () => {
    const hidden = resolveAiStateForDistance({
      behavior: "ambush",
      distance: 6.5,
      attackRange: 1,
      chaseRange: 8,
      ambushRadius: 3.5
    });
    const revealed = resolveAiStateForDistance({
      behavior: "ambush",
      distance: 3,
      attackRange: 1,
      chaseRange: 8,
      ambushRadius: 3.5
    });

    expect(hidden).toBe("ambush");
    expect(revealed).toBe("chase");
  });

  it("supports support behavior classification", () => {
    const near = resolveAiStateForDistance({
      behavior: "support",
      distance: 3.5,
      attackRange: 1,
      chaseRange: 7,
      supportRange: 4
    });
    const far = resolveAiStateForDistance({
      behavior: "support",
      distance: 5.2,
      attackRange: 1,
      chaseRange: 7,
      supportRange: 4
    });

    expect(near).toBe("support");
    expect(far).toBe("idle");
  });
});
