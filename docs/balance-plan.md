# Balance plan: 20–30 minute Normal campaign

## Measured baseline

Measurements used the existing scripted competent bot, `dt = 0.05`, and the same gameplay seed for each bot/idle pair. No source or balance values had been changed.

| Gameplay seed | Bot victory (s) | Final Hub HP | Bot waves | Idle loss (s) | Idle waves |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 20261117 | 246.85 | 2062 | 2 | 319.25 | 3 |
| 424242 | 214.15 | 2098 | 2 | 320.00 | 3 |
| 1 | 247.75 | 2116 | 2 | 319.80 | 3 |
| 90321 | 170.95 | 300 | 1 | 319.30 | 3 |
| 8675309 | 190.20 | 992 | 1 | 219.55 | 2 |

The old `~175s` comment is not the result for its documented seed (`20261117`, actually 246.85s). The closest measured result is seed `90321` at 170.95s.

## Chosen levers

### 1. Make Warp transfer the campaign pacing mechanism

- Keep `TARGET_WARP_AETHER = 1200` and all phase thresholds unchanged.
- Replace the hard-coded base transfer rate of **12 Aether/s** with `WARP_TRANSFER_RATE = 0.3` Aether/s.
- Keep the capacitor bonus at **+45% per level**, so max level transfers at `0.3 × (1 + 4 × 0.45) = 0.975` Aether/s.
- Keep the 150-Aether default reserve and all lab, smelter, node, POI, pod, and objective income unchanged.

This directly paces every phase without making finite nodes unable to support a longer run. It also makes capacitor levels meaningful throughout the campaign. The trade-off is a larger spendable Aether stockpile while transfer is slow; reserve semantics and exact-once income remain unchanged, and the longer combat exposure is measured rather than assumed harmless.

### 2. Stretch wave cadence instead of multiplying total campaign waves

- Set Normal's campaign wave-interval multiplier to **1.5**.
- Initial wave delay becomes `95 × 1.5 = 142.5s`.
- The existing next-wave curve becomes `max(55, 110 - waveCount × 4) × 1.5`; its late-wave interval becomes **82.5s** instead of 55s.
- Keep wave count, composition, elite rules, and HP scaling unchanged.

A 5–6× longer economy should not automatically mean 5–6× as many attacks. This keeps defense relevant while retaining a comparable number of preparation/recovery windows per campaign phase. The trade-off is fewer combat Aether drops and a later idle-player loss; both remain covered by the seeded simulation.

## Difficulty settings

Difficulty is pure configuration applied on top of the new Normal baseline:

| Setting | Enemy HP scale | Wave interval scale | Starting resource scale |
| --- | ---: | ---: | ---: |
| Easy | 0.80 | 1.20 | 1.25 |
| Normal | 1.00 | 1.00 | 1.00 |
| Hard | 1.25 | 0.85 | 0.80 |

Easy therefore gets 20% less enemy HP, 20% longer wave intervals, and 25% more starting resources. Hard gets 25% more enemy HP, 15% shorter intervals, and 20% fewer starting resources. Normal multipliers are exactly 1 and must reproduce the selected baseline.

## Acceptance

- Measure all five baseline seeds again; target Normal victories at **1200–1800s**, with the Hub alive.
- Re-measure idle losses and require defeat rather than merely delaying the existing assertion.
- Preserve deterministic repeat runs, non-negative resources, exact victory thresholds, and exact-once rewards.
- Update assertions only where measured pacing or newly added difficulty behavior requires it.
