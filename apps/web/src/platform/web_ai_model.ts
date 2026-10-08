import type { AIConfig } from '@openframe/providers'
import {
  createProviderModelWithType,
  getDefaultImageModel,
  getDefaultTextModel,
  getDefaultVideoModel,
  isCustomRestModel,
  isImageModel,
  isLanguageModel,
  isVideoModel,
} from '@openframe/providers/factory'
import type { CustomRestModel, VideoModel } from '@openframe/providers/factory'
import type { ImageModel } from 'ai'

function parseModelKey(modelKey?: string): { providerId: string; modelId: string } | null {
  if (!modelKey) return null
  const idx = modelKey.indexOf(':')
  if (idx === -1) return null
  return {
    providerId: modelKey.slice(0, idx),
    modelId: modelKey.slice(idx + 1),
  }
}

export function resolveTextModel(config: AIConfig, modelKey?: string) {
  const parsed = parseModelKey(modelKey)
  const selected = parsed
    ? createProviderModelWithType(parsed.providerId, parsed.modelId, 'text', config)
    : null
  const model = selected && isLanguageModel(selected) ? selected : getDefaultTextModel(config)
  if (!model || !isLanguageModel(model)) return null
  return model
}

export function resolveImageModel(
  config: AIConfig,
  modelKey?: string,
): { model: ImageModel | CustomRestModel } | { error: string } {
  const parsed = parseModelKey(modelKey)
  const selected = parsed
    ? createProviderModelWithType(parsed.providerId, parsed.modelId, 'image', config)
    : null
  const model = selected ?? getDefaultImageModel(config)
  if (!model) return { error: 'No default image model configured.' as const }
  if (!isCustomRestModel(model) && !isImageModel(model)) {
    return { error: 'Selected model is not an image model.' as const }
  }
  return { model }
}

export function resolveVideoModel(
  config: AIConfig,
  modelKey?: string,
): { model: VideoModel | CustomRestModel } | { error: string } {
  const parsed = parseModelKey(modelKey)
  const selected = parsed
    ? createProviderModelWithType(parsed.providerId, parsed.modelId, 'video', config)
    : null
  const model = selected ?? getDefaultVideoModel(config)
  if (!model) return { error: 'No default video model configured.' as const }
  if (!isCustomRestModel(model) && !isVideoModel(model)) {
    const info = describeModel(model)
    return {
      error: `Selected model is not a video model. (modelKey=${modelKey ?? '(none)'}, parsed=${parsed ? `${parsed.providerId}:${parsed.modelId}` : '(none)'}, resolved=${info})`,
    }
  }
  return { model }
}

function describeModel(model: unknown): string {
  if (!model || typeof model !== 'object') return String(model)
  const row = model as Record<string, unknown>
  const id = typeof row.modelId === 'string' ? row.modelId : typeof row.id === 'string' ? row.id : 'unknown'
  const tag = typeof row._tag === 'string' ? row._tag : 'unknown'
  const hasGenerate = typeof (row as { doGenerate?: unknown }).doGenerate === 'function' ? 'generate' : 'no-generate'
  return `${tag}:${id}:${hasGenerate}`
}
