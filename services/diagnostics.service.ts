import AsyncStorage from '@react-native-async-storage/async-storage';

const DIAGNOSTIC_KEY = 'spline:diagnostics:v1';
const MAX_EVENTS = 200;

export interface DiagnosticEvent {
  ts: string;
  stage: string;
  details?: Record<string, unknown>;
}

let eventsCache: DiagnosticEvent[] | null = null;
let writeChain: Promise<void> = Promise.resolve();

const normalizeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'unknown_error';
  }
};

const ensureCache = async (): Promise<DiagnosticEvent[]> => {
  if (eventsCache) {
    return eventsCache;
  }
  try {
    const raw = await AsyncStorage.getItem(DIAGNOSTIC_KEY);
    if (!raw) {
      eventsCache = [];
      return eventsCache;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      eventsCache = parsed.slice(-MAX_EVENTS);
      return eventsCache;
    }
  } catch (error) {
    console.warn('[Diagnostics] Failed to load cache:', normalizeError(error));
  }
  eventsCache = [];
  return eventsCache;
};

const saveCache = async (events: DiagnosticEvent[]) => {
  try {
    await AsyncStorage.setItem(DIAGNOSTIC_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch (error) {
    console.warn('[Diagnostics] Failed to persist event:', normalizeError(error));
  }
};

export const logDiagnosticEvent = async (
  stage: string,
  details?: Record<string, unknown>
): Promise<void> => {
  writeChain = writeChain.then(async () => {
    const events = await ensureCache();
    events.push({
      ts: new Date().toISOString(),
      stage,
      details,
    });
    if (events.length > MAX_EVENTS) {
      events.splice(0, events.length - MAX_EVENTS);
    }
    await saveCache(events);
  });

  return writeChain;
};

export const getDiagnosticEvents = async (): Promise<DiagnosticEvent[]> => {
  const events = await ensureCache();
  return [...events];
};

export const buildDiagnosticReport = async (limit = 120): Promise<string> => {
  const events = await getDiagnosticEvents();
  const recent = events.slice(-Math.max(1, limit));
  const header = [
    'Spline Diagnostics Report',
    `generated_at=${new Date().toISOString()}`,
    `events_count=${recent.length}`,
    '---',
  ];

  const lines = recent.map((event, index) => {
    const details = event.details ? JSON.stringify(event.details) : '{}';
    return `${index + 1}. ts=${event.ts} stage=${event.stage} details=${details}`;
  });

  return [...header, ...lines].join('\n');
};

export const clearDiagnosticEvents = async (): Promise<void> => {
  eventsCache = [];
  try {
    await AsyncStorage.removeItem(DIAGNOSTIC_KEY);
  } catch (error) {
    console.warn('[Diagnostics] Failed to clear events:', normalizeError(error));
  }
};

