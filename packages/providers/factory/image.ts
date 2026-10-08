import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createXai } from '@ai-sdk/xai'
import { createAzure } from '@ai-sdk/azure'
import { createTogetherAI } from '@ai-sdk/togetherai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateImage } from 'ai'
import type { ImageModel } from 'ai'
import type { AIProviderConfig } from '../config'
import { isBuiltInProvider } from '../providers'
import { customRest } from './custom-rest'
import type {
  AnyModel,
  CustomRestModel,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImagePrompt,
  MediaReference,
} from './types'
import { isCustomRestModel } from './types'
import { createZhipuImageModel } from './platforms/zhipu'
import { generateVolcengineImage } from './platforms/volcengine'
import { generateQwenImage } from './platforms/qwen'
import { generateOpenAICompatibleImage } from './platforms/openai-compatible-media'

function hasReferenceImages(prompt: ImagePrompt): prompt is { text?: string; images: MediaReference[] } {
  return typeof prompt !== 'string' && Array.isArray(prompt.images) && prompt.images.length > 0
}

function normalizeGoogleImageModelId(modelId: string): string {
  const normalized = modelId.trim().toLowerCase().replace(/[_\s]+/g, '-')
  if (['nano-banana', 'nano-bananer', 'nano-banana-pro', 'nanobanana'].includes(normalized)) {
    return 'gemini-2.5-flash-image'
  }
  return modelId
}

function toTextOnlyPrompt(prompt: ImagePrompt): string {
  if (typeof prompt === 'string') return prompt
  return prompt.text || ''
}

function toSdkImageSize(value: string | undefined): `${number}x${number}` | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!/^\d+x\d+$/i.test(trimmed)) return undefined
  return trimmed.toLowerCase() as `${number}x${number}`
}

function toSdkAspectRatio(value: string | undefined): `${number}:${number}` | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!/^\d+:\d+$/.test(trimmed)) return undefined
  return trimmed as `${number}:${number}`
}

function buildSdkImageArgs(
  model: ImageModel,
  prompt: string | { text?: string; images: Array<string | Uint8Array> },
  options: ImageGenerationOptions | undefined,
): {
  model: ImageModel
  prompt: string | { text?: string; images: Array<string | Uint8Array> }
  n: number
  size?: `${number}x${number}`
  aspectRatio?: `${number}:${number}`
} {
  const size = toSdkImageSize(options?.size)
  const aspectRatio = toSdkAspectRatio(options?.ratio)
  return {
    model,
    prompt,
    n: 1,
    ...(size ? { size } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
  }
}


export function buildImageModel(providerId: string, modelId: string, cfg: AIProviderConfig): AnyModel | null {
  const apiKey = cfg.apiKey || undefined
  const baseURL = cfg.baseUrl || undefined

  switch (providerId) {
    case 'openai':
      return createOpenAI({ apiKey, baseURL }).image(modelId)
    case 'google':
      return createGoogleGenerativeAI({ apiKey, baseURL }).image(normalizeGoogleImageModelId(modelId))
    case 'xai':
      return createXai({ apiKey, baseURL }).image(modelId)
    case 'azure':
      return createAzure({ apiKey, baseURL }).image(modelId)
    case 'togetherai':
      return createTogetherAI({ apiKey, baseURL }).image(modelId)
    case 'zhipu':
      return createZhipuImageModel(modelId, apiKey, baseURL)
    case 'volcengine':
      return customRest(providerId, modelId, 'image', cfg)
    case 'qwen':
      return customRest(providerId, modelId, 'image', cfg)
    default:
      if (!isBuiltInProvider(providerId)) {
        return customRest(providerId, modelId, 'image', cfg)
      }
      if (!baseURL) return null
      return createOpenAICompatible({
        name: providerId,
        baseURL,
        apiKey: apiKey ?? 'openframe',
      }).imageModel(modelId)
  }
}

export async function generateImageWithProviderSupport(
  args: {
    model: ImageModel | CustomRestModel
    prompt: ImagePrompt
    options?: ImageGenerationOptions
  },
): Promise<ImageGenerationResult> {
  if (isCustomRestModel(args.model)) {
    const prompt = toTextOnlyPrompt(args.prompt)
    const images = hasReferenceImages(args.prompt) ? args.prompt.images : []

    if (args.model.providerId === 'qwen') {
      if (hasReferenceImages(args.prompt) && !/^qwen-image/i.test(args.model.modelId.trim())) {
        throw new Error('Qwen image API currently supports text prompt only in this adapter.')
      }
      const apiKey = args.model.apiKey || ''
      if (!apiKey) throw new Error('Qwen API key is missing.')
      return generateQwenImage({
        apiKey,
        baseURL: args.model.baseUrl || undefined,
        modelId: args.model.modelId,
        prompt,
        ...(images.length > 0 ? { referenceImages: images } : {}),
        size: args.options?.size,
        ratio: args.options?.ratio,
      })
    }

    if (args.model.providerId === 'volcengine') {
      const apiKey = args.model.apiKey || ''
      if (!apiKey) throw new Error('Volcengine API key is missing.')
      return generateVolcengineImage({
        apiKey,
        baseURL: args.model.baseUrl || undefined,
        modelId: args.model.modelId,
        prompt,
        images,
        size: args.options?.size,
        ratio: args.options?.ratio,
      })
    }

    return generateOpenAICompatibleImage({
      apiKey: args.model.apiKey || undefined,
      baseURL: args.model.baseUrl || undefined,
      modelId: args.model.modelId,
      prompt,
      images,
      size: args.options?.size,
      ratio: args.options?.ratio,
    })
  }

  const normalizedPrompt =
    typeof args.prompt === 'string'
      ? args.prompt
      : {
          text: args.prompt.text,
          images: (args.prompt.images ?? []).map((img) => (Array.isArray(img) ? new Uint8Array(img) : img)),
        }

  const sdkArgs = buildSdkImageArgs(args.model, normalizedPrompt, args.options)

  try {
    const result = await generateImage(sdkArgs)
    return { data: Array.from(result.image.uint8Array), mediaType: result.image.mediaType }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const shouldRetryTextOnly = /\bnot\s*found\b/i.test(msg) && hasReferenceImages(args.prompt)
    if (!shouldRetryTextOnly) throw err

    const fallbackArgs = buildSdkImageArgs(args.model, toTextOnlyPrompt(args.prompt), args.options)
    const result = await generateImage(fallbackArgs)
    return { data: Array.from(result.image.uint8Array), mediaType: result.image.mediaType }
  }
}
