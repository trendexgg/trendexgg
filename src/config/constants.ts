export const SLOT_DIVISOR = 1000;

export const MAX_WINNERS = 64;

export const VRF_CONFIG = {
  BYTES_PER_SELECTION: 8,
  CONFIRMATION_LEVEL: "confirmed" as const,
  /**
   * Byte window of the raw Orao account data used for randomness.
   * Standard (Draws 1 & 3): [40, 104]  — matches Orao SDK default.
   * Draw 2 used [73, 137] due to a script-level bug (now corrected).
   * This value is logged on every run and must never change silently.
   */
  RANDOMNESS_OFFSET: [40, 104] as [number, number],
} as const;

