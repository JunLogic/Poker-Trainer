import { gtoV1StrategyProfile } from './profiles/gto-v1.js';
import type { StrategyProfile, StrategyProfileId } from './types.js';

export const DEFAULT_STRATEGY_PROFILE_ID = 'gto-v1' as const;

const profiles = new Map<StrategyProfileId, StrategyProfile>();

registerStrategyProfile(gtoV1StrategyProfile);

export function registerStrategyProfile(profile: StrategyProfile): void {
  profiles.set(profile.id, profile);
}

export function getStrategyProfile(id: StrategyProfileId): StrategyProfile | undefined {
  return profiles.get(id);
}

export function getDefaultStrategyProfile(): StrategyProfile {
  const profile = profiles.get(DEFAULT_STRATEGY_PROFILE_ID);
  if (!profile) throw new Error(`Default strategy profile ${DEFAULT_STRATEGY_PROFILE_ID} is not registered`);
  return profile;
}

export function listStrategyProfiles(): StrategyProfile[] {
  return [...profiles.values()];
}
