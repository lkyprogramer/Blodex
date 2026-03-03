import { describe, expect, it } from "vitest";
import {
  buildDailyHistoryEntry,
  canStartDailyScoredAttempt,
  computeDailyScore,
  createDailySeed,
  markDailyRewardClaimed,
  resolveDailyDate,
  upsertDailyHistory
} from "../daily";
import { createInitialMeta } from "../run";

describe("daily", () => {
  it("creates deterministic daily seed", () => {
    const date = "2026-03-02";
    expect(createDailySeed(date)).toBe(createDailySeed(date));
    expect(createDailySeed("2026-03-03")).not.toBe(createDailySeed(date));
  });

  it("formats local date key from timestamp", () => {
    expect(resolveDailyDate(new Date("2026-03-02T10:11:12+08:00").getTime())).toBe("2026-03-02");
  });

  it("computes score with floor/kill/time/challenge inputs", () => {
    expect(
      computeDailyScore({
        floorReached: 8,
        kills: 120,
        clearTimeMs: 500_000,
        challengeSuccessCount: 2
      })
    ).toBe(10_100);
  });

  it("enforces one scored attempt per day and keeps 30-day history", () => {
    const meta = createInitialMeta();
    const seed = createDailySeed("2026-03-02");
    const firstEntry = buildDailyHistoryEntry(
      "2026-03-02",
      seed,
      {
        floorReached: 6,
        kills: 80,
        elapsedMs: 420_000,
        challengeSuccessCount: 1
      },
      true
    );
    const scored = upsertDailyHistory(meta, firstEntry);
    expect(canStartDailyScoredAttempt(scored, "2026-03-02")).toBe(false);

    const practice = upsertDailyHistory(
      scored,
      {
        ...firstEntry,
        score: firstEntry.score + 999
      },
      { practice: true }
    );
    expect(practice.dailyHistory[0]?.score).toBe(firstEntry.score);

    let rolling = scored;
    for (let day = 3; day <= 40; day += 1) {
      const key = `2026-03-${`${day}`.padStart(2, "0")}`;
      rolling = upsertDailyHistory(
        rolling,
        buildDailyHistoryEntry(
          key,
          createDailySeed(key),
          {
            floorReached: 5,
            kills: 40,
            elapsedMs: 600_000,
            challengeSuccessCount: 0
          },
          false
        )
      );
    }
    expect(rolling.dailyHistory.length).toBe(30);
  });

  it("claims daily reward idempotently", () => {
    const date = "2026-03-02";
    const once = markDailyRewardClaimed(createInitialMeta(), date);
    const twice = markDailyRewardClaimed(once, date);
    expect(once.dailyRewardClaimedDates).toEqual([date]);
    expect(twice.dailyRewardClaimedDates).toEqual([date]);
  });
});
