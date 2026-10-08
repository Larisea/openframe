import type { AIConfig } from '@openframe/providers'
import { DEFAULT_AI_CONFIG } from '@openframe/providers'

export const SETTINGS_KEYS = [
  'language',
  'theme',
  'onboarding_seen',
  'onboarding_version',
  'update_dismissed_version',
  'prompt_overrides',
  'storage_config',
] as const

export type AllowedSettingKey = (typeof SETTINGS_KEYS)[number]

const SETTINGS_PREFIX = 'openframe:web:setting:'
const AI_CONFIG_KEY = 'openframe:web:ai_config'
export const VECTOR_DIMENSION_KEY = 'openframe:web:vec_dimension'
export const DATA_DIR_KEY = 'openframe:web:data_dir'
export const DEFAULT_DATA_DIR = 'browser://indexeddb'

export function getSettingStorageKey(key: AllowedSettingKey): string {
  return `${SETTINGS_PREFIX}${key}`
}

export function localGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function localSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore quota/storage errors in fallback runtime
  }
}

export function localDelete(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore storage errors in fallback runtime
  }
}

export function getStoredSetting(key: AllowedSettingKey): string {
  return localGet(getSettingStorageKey(key)) ?? ''
}

export function readJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage errors in fallback runtime
  }
}

export function getCurrentAIConfig(): AIConfig {
  return readJSON(localGet(AI_CONFIG_KEY), DEFAULT_AI_CONFIG)
}

export function saveCurrentAIConfig(config: unknown): void {
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config))
  } catch (err) {
    throw new Error(`AI config failed to persist: ${err instanceof Error ? err.message : String(err)}`)
  }
}
