import type { CodexTaskStatus } from '../codex/codex-task-source.ts';

export type AttentionState =
  | 'idle'
  | 'working'
  | 'waiting-for-input'
  | 'waiting-for-approval'
  | 'interrupted'
  | 'failed'
  | 'unavailable'
  | 'stale';

export interface AttentionIndicator {
  readonly state: AttentionState;
  readonly count: number;
}

export interface AttentionSummary {
  readonly primary: AttentionState;
  readonly indicators: readonly AttentionIndicator[];
  readonly additionalStates: number;
}

export type VisualIcon = 'entry' | 'project' | 'task' | 'back';

export interface VisualPresentation {
  readonly icon: VisualIcon;
  readonly glyph: string;
  readonly tone: AttentionState | 'navigation';
  readonly backgroundColor: string;
  readonly foregroundColor: '#FFFFFF';
  readonly borderColors: readonly string[];
  readonly badge: string;
}

const MAXIMUM_VISIBLE_ATTENTION_STATES = 3;
const ATTENTION_PRECEDENCE: readonly AttentionState[] = [
  'failed',
  'waiting-for-approval',
  'waiting-for-input',
  'interrupted',
  'unavailable',
  'stale',
  'working',
  'idle',
];

const VISUAL_TOKENS: Readonly<Record<AttentionState, {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly badge: string;
}>> = {
  idle: { backgroundColor: '#1F2937', borderColor: '#9CA3AF', badge: 'OK' },
  working: { backgroundColor: '#075985', borderColor: '#38BDF8', badge: '>' },
  'waiting-for-input': { backgroundColor: '#1E3A8A', borderColor: '#60A5FA', badge: 'I' },
  'waiting-for-approval': { backgroundColor: '#713F12', borderColor: '#FACC15', badge: 'A' },
  interrupted: { backgroundColor: '#4C1D95', borderColor: '#A78BFA', badge: 'X' },
  failed: { backgroundColor: '#7F1D1D', borderColor: '#F87171', badge: '!' },
  unavailable: { backgroundColor: '#3F3F46', borderColor: '#D4D4D8', badge: '?' },
  stale: { backgroundColor: '#57534E', borderColor: '#FDBA74', badge: '~' },
};

const ICON_GLYPHS: Readonly<Record<VisualIcon, string>> = {
  entry: 'C',
  project: 'P',
  task: 'T',
  back: '<',
};

export function aggregateAttention(states: readonly AttentionState[]): AttentionSummary {
  const counts = new Map<AttentionState, number>();
  const observed = states.length === 0
    ? ['idle' as const]
    : states.some((state) => state !== 'idle')
      ? states.filter((state) => state !== 'idle')
      : states;
  for (const state of observed) {
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  const ordered = ATTENTION_PRECEDENCE
    .filter((state) => counts.has(state))
    .map((state) => ({ state, count: counts.get(state)! }));
  const indicators = ordered.slice(0, MAXIMUM_VISIBLE_ATTENTION_STATES);
  return {
    primary: indicators[0]!.state,
    indicators,
    additionalStates: ordered.length - indicators.length,
  };
}

export function taskAttentionState(status: CodexTaskStatus): AttentionState {
  return status === 'completed' ? 'idle' : status;
}

export function visualizeAttention(
  summary: AttentionSummary,
  icon: Exclude<VisualIcon, 'back'>,
): VisualPresentation {
  const primary = VISUAL_TOKENS[summary.primary];
  const badge = summary.indicators
    .map(({ state }) => VISUAL_TOKENS[state].badge)
    .join('');
  return {
    icon,
    glyph: ICON_GLYPHS[icon],
    tone: summary.primary,
    backgroundColor: primary.backgroundColor,
    foregroundColor: '#FFFFFF',
    borderColors: summary.indicators.map(({ state }) => VISUAL_TOKENS[state].borderColor),
    badge: `${badge}${summary.additionalStates > 0 ? `+${summary.additionalStates}` : ''}`,
  };
}

export function navigationVisual(): VisualPresentation {
  return {
    icon: 'back',
    glyph: ICON_GLYPHS.back,
    tone: 'navigation',
    backgroundColor: '#111827',
    foregroundColor: '#FFFFFF',
    borderColors: [],
    badge: '',
  };
}
