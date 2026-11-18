import { mulberry32 } from '@/utils/random';

export type RandomStream = () => number;

/** Stream salts keep terrain/resources/POI layouts independent of each other. */
const TERRAIN_SALT = 0x9e3779b9;
const RESOURCE_SALT = 0x85ebca6b;

/**
 * Centralized randomness. World-generation streams (terrain, resources, POIs)
 * are seeded from the world seed and fully reproducible. The gameplay stream
 * defaults to Math.random so per-run events (crits, waves, particles) stay
 * varied — and the seeded balance-simulation harness keeps controlling them.
 */
export class RandomService {
  public readonly terrain: RandomStream;
  public readonly resources: RandomStream;
  public readonly poi: RandomStream;
  public readonly gameplay: RandomStream;

  constructor(
    public readonly worldSeed: number,
    // Lazy wrapper: always reads the current global so test spies and the
    // seeded balance harness (which reassign Math.random) keep working.
    gameplay: RandomStream = () => Math.random()
  ) {
    this.terrain = mulberry32(worldSeed ^ TERRAIN_SALT);
    this.resources = mulberry32(worldSeed ^ RESOURCE_SALT);
    // POIs keep the exact legacy seed so the established layout is unchanged.
    this.poi = mulberry32(worldSeed);
    this.gameplay = gameplay;
  }
}

/** Default seeded stream for resource placement outside an engine instance. */
export function defaultResourceStream(worldSeed: number): RandomStream {
  return mulberry32(worldSeed ^ RESOURCE_SALT);
}