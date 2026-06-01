/**
 * Parallel annotation layer — completely outside the engine's action types.
 * Keyed by Action.id so it can be looked up during replay without modifying
 * the action log. This is also the shape the future coach stub will consume.
 */
export interface ThoughtEntry {
  readonly actionId: string;       // matches the Action.id in the engine log
  readonly actionIndex: number;    // 0-based position in actionLog for stable reference
  readonly thought: string;        // user's free text; may be empty string
  readonly equity: number;         // hero MC equity at moment of decision (0–1)
  readonly street: string;
  readonly pot: number;
  readonly betToCall: number;      // 0 when check was available
  readonly takenActionType: string; // e.g. 'BET' | 'FOLD' | 'RAISE'
  readonly timestamp: number;
}

export interface HandAnnotations {
  readonly handId: string;
  /** Record keyed by Action.id */
  readonly thoughts: Record<string, ThoughtEntry>;
}
