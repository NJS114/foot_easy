import type { Formation, SlotInput } from "@/api/client";

export type Slots = SlotInput[];

export type PitchPosition = { index: number; x: number; y: number };

/** Places a player on a starter position, moving away whoever held it. */
export function assignStarter(slots: Slots, memberId: string, positionIndex: number): Slots {
  const others = slots.filter(
    (slot) => slot.member_id !== memberId && slot.position_index !== positionIndex,
  );
  return [...others, { member_id: memberId, role: "starter", position_index: positionIndex }];
}

export function assignSubstitute(slots: Slots, memberId: string): Slots {
  const others = slots.filter((slot) => slot.member_id !== memberId);
  return [...others, { member_id: memberId, role: "substitute", position_index: null }];
}

export function removePlayer(slots: Slots, memberId: string): Slots {
  return slots.filter((slot) => slot.member_id !== memberId);
}

/** Drops starters whose position no longer exists after a formation change. */
export function fitToFormation(slots: Slots, formation: Formation): Slots {
  return slots.filter(
    (slot) => slot.role === "substitute" || (slot.position_index ?? 0) < formation.players,
  );
}

/**
 * Pitch coordinates (percent) for each position: goalkeeper at the bottom, then one row per
 * formation line from defence to attack.
 */
export function pitchPositions(formation: Formation): PitchPosition[] {
  const rows = [1, ...formation.lines];
  const rowGap = 80 / (rows.length - 1);
  let index = 0;
  return rows.flatMap((count, row) =>
    Array.from({ length: count }, (_, column) => ({
      index: index++,
      x: ((column + 1) / (count + 1)) * 100,
      y: 90 - row * rowGap,
    })),
  );
}
