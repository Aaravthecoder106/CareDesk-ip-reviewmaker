/**
 * Lightweight structured logger.
 *
 * In production this should be replaced with Pino or similar. For now it
 * outputs JSON lines to stdout so log aggregators can parse them.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info({ route: '/api/chat', userId, durationMs }, 'Chat request completed')
 *   logger.error({ route: '/api/reports/upload', err }, 'Upload failed')
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  timestamp: string
  message: string
  [key: string]: unknown
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info'

function emit(entry: LogEntry) {
  if (LEVEL_PRIORITY[entry.level] < LEVEL_PRIORITY[minLevel]) return
  if (process.env.NODE_ENV === 'production') {
    console[entry.level === 'error' ? 'error' : 'log'](JSON.stringify(entry))
  } else {
    const { level, timestamp, message, ...rest } = entry
    const extras = Object.keys(rest).length ? ' ' + JSON.stringify(rest, null, 2) : ''
    console[level === 'error' ? 'error' : 'log'](
      `[${timestamp}] ${level.toUpperCase()} ${message}${extras}`,
    )
  }
}

/**
 * Structured logger — call as logger.info({ ...data }, 'message')
 * or logger.info('message', { ...data }).
 */
export const logger = {
  debug(messageOrData: string | Record<string, unknown>, dataOrMessage?: Record<string, unknown> | string) {
    const [message, data] = typeof messageOrData === 'string'
      ? [messageOrData, dataOrMessage as Record<string, unknown> | undefined]
      : [dataOrMessage as string, messageOrData]
    emit({ level: 'debug', timestamp: new Date().toISOString(), message, ...data })
  },
  info(messageOrData: string | Record<string, unknown>, dataOrMessage?: Record<string, unknown> | string) {
    const [message, data] = typeof messageOrData === 'string'
      ? [messageOrData, dataOrMessage as Record<string, unknown> | undefined]
      : [dataOrMessage as string, messageOrData]
    emit({ level: 'info', timestamp: new Date().toISOString(), message, ...data })
  },
  warn(messageOrData: string | Record<string, unknown>, dataOrMessage?: Record<string, unknown> | string) {
    const [message, data] = typeof messageOrData === 'string'
      ? [messageOrData, dataOrMessage as Record<string, unknown> | undefined]
      : [dataOrMessage as string, messageOrData]
    emit({ level: 'warn', timestamp: new Date().toISOString(), message, ...data })
  },
  error(messageOrData: string | Record<string, unknown>, dataOrMessage?: Record<string, unknown> | string) {
    const [message, data] = typeof messageOrData === 'string'
      ? [messageOrData, dataOrMessage as Record<string, unknown> | undefined]
      : [dataOrMessage as string, messageOrData]
    emit({ level: 'error', timestamp: new Date().toISOString(), message, ...data })
  },
}
