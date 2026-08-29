type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? 1;

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: Level, scope: string, message: string, meta?: unknown) {
  if (LEVELS[level] < currentLevel) return;
  const prefix = `[${timestamp()}] [${level.toUpperCase()}] [${scope}]`;
  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console.log(prefix, message, meta);
  } else {
    // eslint-disable-next-line no-console
    console.log(prefix, message);
  }
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: unknown) => write('debug', scope, message, meta),
    info: (message: string, meta?: unknown) => write('info', scope, message, meta),
    warn: (message: string, meta?: unknown) => write('warn', scope, message, meta),
    error: (message: string, meta?: unknown) => write('error', scope, message, meta)
  };
}

export const logger = createLogger('app');
