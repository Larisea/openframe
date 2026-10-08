import { experimental_generateVideo } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { AIProviderConfig } from '../config'
import { isBuiltInProvider } from '../providers'
import { bytesToDataUrl } from '@openframe/shared'
import { customRest } from './custom-rest'
import type {
  AnyModel,
  CustomRestModel,
  VideoGenerationOptions,
  VideoGenerationResult,
  VideoModel,
  VideoPrompt,
} from './types'
import { isCustomRestModel } from './types'
import { createQwenVideoModel } from './platforms/qwen'
import { generateVolcengineVideo } from './platforms/volcengine'
import { generateOpenAICompatibleVideo } from './platforms/openai-compatible-media'

/** DashScope-style video endpoints (e.g. 阿里云百炼/HappyHorse on maas workspace
 * domains) hard-fail with "Range of input length should be [1, 61440]" when the
 * prompt exceeds their validation cap, and truncate content beyond the model's
 * documented limit (HappyHorse: 5000 non-Chinese / 2500 Chinese chars). Cap the
 * prompt before sending so every request passes validation with the info the
 * model would keep anyway. */
const VIDEO_PROMPT_MAX_CHARS = 5000

function capPrompt(text: string): string {
  return text.length > VIDEO_PROMPT_MAX_CHARS ? text.slice(0, VIDEO_PROMPT_MAX_CHARS) : text
}

function toTextPrompt(prompt: VideoPrompt): string {
  const text = typeof prompt === 'string' ? prompt : prompt.text || ''
  return capPrompt(text)
}

function toImageRefs(prompt: VideoPrompt): Array<string | number[]> {
  if (typeof prompt === 'string' || !Array.isArray(prompt.images)) return []
  return prompt.images
}

function isAlibabaSdkVideoModel(model: VideoModel): boolean {
  return model.provider.toLowerCase().startsWith('alibaba')
}

function isAlibabaR2vModel(model: VideoModel): boolean {
  return isAlibabaSdkVideoModel(model) && /-r2v/i.test(model.modelId)
}

function toReferenceUrls(prompt: VideoPrompt): string[] {
  return toImageRefs(prompt)
    .map((ref) => (typeof ref === 'string' ? ref : bytesToDataUrl(ref, 'image/png')))
    .slice(0, 5)
}

function toSdkVideoPrompt(
  model: VideoModel,
  prompt: VideoPrompt,
): string | { image: string | Uint8Array; text?: string } {
  if (typeof prompt === 'string') return capPrompt(prompt)

  if (isAlibabaR2vModel(model)) {
    return capPrompt(prompt.text || '')
  }

  const refs = Array.isArray(prompt.images) ? prompt.images : []
  if (refs.length === 0) return capPrompt(prompt.text || '')

  const first = refs[0]
  return {
    image: Array.isArray(first) ? new Uint8Array(first) : first,
    text: prompt.text ? capPrompt(prompt.text) : undefined,
  }
}

function toAspectRatio(ratio: string | undefined): `${number}:${number}` | undefined {
  if (!ratio) return undefined
  const trimmed = ratio.trim()
  if (!/^\d+:\d+$/.test(trimmed)) return undefined
  return trimmed as `${number}:${number}`
}

function normalizeGoogleVideoModelId(modelId: string): string {
  const normalized = modelId.trim().toLowerCase().replace(/[_\s]+/g, '-')
  if (['veo3', 'veo-3', 'veo-3.0', 'veo-3.0-generate-preview'].includes(normalized)) {
    return 'veo-3.1-generate-preview'
  }
  if (['veo3-fast', 'veo-3-fast', 'veo-3.0-fast'].includes(normalized)) {
    return 'veo-3.1-fast-generate-preview'
  }
  if (['veo2', 'veo-2'].includes(normalized)) {
    return 'veo-2.0-generate-001'
  }
  return modelId
}

function toVideoProviderOptions(
  model: VideoModel,
  prompt: VideoPrompt,
): { alibaba: { referenceUrls: string[] } } | undefined {
  if (!isAlibabaR2vModel(model)) return undefined

  const referenceUrls = toReferenceUrls(prompt)
  if (!referenceUrls.length) return undefined

  return {
    alibaba: {
      referenceUrls,
    },
  }
}

export function buildVideoModel(providerId: string, modelId: string, cfg: AIProviderConfig): AnyModel | null {
  const apiKey = cfg.apiKey || undefined
  const baseURL = cfg.baseUrl || undefined

  switch (providerId) {
    case 'google':
      return createGoogleGenerativeAI({ apiKey, baseURL }).video(normalizeGoogleVideoModelId(modelId))
    case 'qwen':
      return createQwenVideoModel(modelId, apiKey, baseURL)
    case 'volcengine':
      return customRest(providerId, modelId, 'video', cfg)
    default:
      if (!isBuiltInProvider(providerId)) {
        return customRest(providerId, modelId, 'video', cfg)
      }
      if (!baseURL) return null
      return customRest(providerId, modelId, 'video', cfg)
  }
}

export async function generateVideoWithProviderSupport(
  args: {
    model: VideoModel | CustomRestModel
    prompt: VideoPrompt
    options?: VideoGenerationOptions
  },
): Promise<VideoGenerationResult> {
  if (isCustomRestModel(args.model)) {
    if (args.model.providerId === 'volcengine') {
      const apiKey = args.model.apiKey || ''
      if (!apiKey) throw new Error('Volcengine API key is missing.')
      return generateVolcengineVideo({
        modelId: args.model.modelId,
        apiKey,
        baseURL: args.model.baseUrl || undefined,
        prompt: toTextPrompt(args.prompt),
        images: toImageRefs(args.prompt),
        ratio: args.options?.ratio,
        durationSec: args.options?.durationSec,
      })
    }
    return generateOpenAICompatibleVideo({
      apiKey: args.model.apiKey || undefined,
      baseURL: args.model.baseUrl || undefined,
      modelId: args.model.modelId,
      prompt: toTextPrompt(args.prompt),
      images: toImageRefs(args.prompt),
      ratio: args.options?.ratio,
      durationSec: args.options?.durationSec,
    })
  }

  const result = await experimental_generateVideo({
    model: args.model,
    prompt: toSdkVideoPrompt(args.model, args.prompt),
    n: 1,
    aspectRatio: toAspectRatio(args.options?.ratio),
    duration: args.options?.durationSec,
    providerOptions: toVideoProviderOptions(args.model, args.prompt),
  })

  return {
    data: Array.from(result.video.uint8Array),
    mediaType: result.video.mediaType || 'video/mp4',
  }
}
