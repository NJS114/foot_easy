import { describe, expect, it } from "vitest";
import {
  assignStarter,
  assignSubstitute,
  fitToFormation,
  pitchPositions,
  removePlayer,
} from "@/lib/lineup";

const FOUR_FOUR_TWO = { code: "4-4-2", players: 11, lines: [4, 4, 2] };
const FIVE_A_SIDE = { code: "2-2", players: 5, lines: [2, 2] };

describe("lineup helpers", () => {
  it("assigns a starter and evicts the previous holder of the position", () => {
    const slots = assignStarter([], "a", 3);

    const next = assignStarter(slots, "b", 3);

    expect(next).toEqual([{ member_id: "b", role: "starter", position_index: 3 }]);
  });

  it("moves a starter to the bench without duplicating them", () => {
    const slots = assignSubstitute(assignStarter([], "a", 0), "a");

    expect(slots).toEqual([{ member_id: "a", role: "substitute", position_index: null }]);
  });

  it("removes a player", () => {
    expect(removePlayer(assignSubstitute([], "a"), "a")).toEqual([]);
  });

  it("drops starters outside a smaller formation but keeps the bench", () => {
    const slots = assignSubstitute(assignStarter(assignStarter([], "a", 1), "b", 9), "c");

    expect(fitToFormation(slots, FIVE_A_SIDE).map((slot) => slot.member_id)).toEqual(["a", "c"]);
  });

  it("computes one pitch position per player, goalkeeper first", () => {
    const positions = pitchPositions(FOUR_FOUR_TWO);

    expect(positions).toHaveLength(11);
    expect(positions[0]).toMatchObject({ index: 0, x: 50, y: 90 });
    expect(positions.every((position) => position.y >= 10 && position.y <= 90)).toBe(true);
  });
});
