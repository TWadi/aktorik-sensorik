// Strain gauge and Wheatstone bridge. Pure functions, SI units.
//
// Bridge layout used on the site:
//   left branch:  R1 (top) and R2 (bottom)      right branch: R4 (top) and R3 (bottom)
//   U_a is measured between the two mid points: U_a = U_e · (R1/(R1+R2) − R4/(R3+R4))

/** Typical metal-foil strain gauge. */
export const STRAIN_GAUGE = Object.freeze({ R: 350, k: 2 });

/** Resistance change of a strain gauge: ΔR = R·k·ε. */
export const gaugeDeltaR = (R, k, eps) => R * k * eps;

/** Exact bridge output voltage. */
export const bridgeOut = (R1, R2, R3, R4, Ue) => Ue * (R1 / (R1 + R2) - R4 / (R3 + R4));

/** Linear approximation for small changes around four equal resistors R. */
export const bridgeApprox = (dR1, dR2, dR3, dR4, R, Ue) => (Ue / 4) * ((dR1 - dR2 + dR3 - dR4) / R);

/**
 * The four resistances for a bridge with 1, 2 or 4 active gauges.
 * quarter: R1 stretched · half: R1 stretched, R2 compressed · full: R1, R3 stretched, R2, R4 compressed
 * @param {'quarter' | 'half' | 'full'} kind
 * @returns {[number, number, number, number]} [R1, R2, R3, R4]
 */
export function bridgeResistors(kind, R, dR) {
  if (kind === 'full') return [R + dR, R - dR, R + dR, R - dR];
  if (kind === 'half') return [R + dR, R - dR, R, R];
  return [R + dR, R, R, R];
}

/** Factor in U_a ≈ factor · k · ε · U_e. */
export const bridgeFactor = (kind) => ({ quarter: 0.25, half: 0.5, full: 1 }[kind]);
