import type { LanguageModel, ImageModel } from 'ai'
import type { Experimental_VideoModelV3 } from '@ai-sdk/provider'
import type { ModelType } from '../providers'

export type VideoModel = Experimental_VideoModelV3

export interface CustomRestModel {
  readonly _tag: 'custom-rest'
  readonly providerId: string
  readonly modelId: string
  readonly modelType: ModelType
  readonly apiKey: string | undefined
  readonly baseUrl: string | undefined
}

export type AnyModel = LanguageModel | ImageModel | VideoModel | CustomRestModel

export function isCustomRestModel(m: AnyModel): m is CustomRestModel {
  return (m as CustomRestModel)._tag === 'custom-rest'
}

export function isLanguageModel(m: AnyModel): m is LanguageModel {
  return !isCustomRestModel(m) && typeof (m as { doStream?: unknown }).doStream === 'function'
}

export function isImageModel(m: AnyModel): m is ImageModel {
  return (
    !isCustomRestModel(m) &&
    !isLanguageModel(m) &&
    typeof (m as { doGenerate?: unknown }).doGenerate === 'function' &&
    // AI SDK v6: both ImageModel and VideoModel expose doGenerate.
    // VideoModel is uniquely marked by maxVideosPerCall, so exclude it here.
    typeof (m as { maxVideosPerCall?: unknown }).maxVideosPerCall === 'undefined'
  )
}

export function isVideoModel(m: AnyModel): m is VideoModel {
  return (
    !isCustomRestModel(m) &&
    !isLanguageModel(m) &&
    typeof (m as { doGenerate?: unknown }).doGenerate === 'function' &&
    typeof (m as { maxVideosPerCall?: unknown }).maxVideosPerCall !== 'undefined'
  )
}

export type MediaReference = string | number[]

export interface ImagePromptObject {
  text?: string
  images?: MediaReference[]
}

export interface VideoPromptObject {
  text?: string
  images?: MediaReference[]
}

export type ImagePrompt = string | ImagePromptObject
export type VideoPrompt = string | VideoPromptObject

export interface ImageGenerationOptions {
  size?: string
  ratio?: string
}

export interface VideoGenerationOptions {
  ratio?: string
  durationSec?: number
}

export interface ImageGenerationResult {
  data: number[]
  mediaType: string
  url?: string
}

export interface VideoGenerationResult {
  data: number[]
  mediaType: string
  url?: string
}

export type MediaGenerationResult = ImageGenerationResult | VideoGenerationResult

export function parseModelKey(key: string | undefined): { providerId: string; modelId: string } | null {
  if (!key) return null
  const idx = key.indexOf(':')
  if (idx === -1) return null
  return {
    providerId: key.slice(0, idx),
    modelId: key.slice(idx + 1),
  }
}
