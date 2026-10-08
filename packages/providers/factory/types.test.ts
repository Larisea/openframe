import { describe, expect, it, vi } from 'vitest'
import {
  isCustomRestModel,
  isImageModel,
  isLanguageModel,
  isVideoModel,
  parseModelKey,
} from './types'

describe('factory type helpers', () => {
  it('parses provider:model keys with first-colon split', () => {
    expect(parseModelKey(undefined)).toBeNull()
    expect(parseModelKey('bad-key')).toBeNull()
    expect(parseModelKey('openai:gpt-4o')).toEqual({
      providerId: 'openai',
      modelId: 'gpt-4o',
    })
    expect(parseModelKey('ollama:llama3.2:3b')).toEqual({
      providerId: 'ollama',
      modelId: 'llama3.2:3b',
    })
  })

  it('detects custom-rest, language, image, and video models', () => {
    const customRest = {
      _tag: 'custom-rest',
      providerId: 'custom',
      modelId: 'm1',
      modelType: 'text',
      apiKey: undefined,
      baseUrl: undefined,
    }
    const languageModel = { doStream: vi.fn() }
    const imageModel = { doGenerate: vi.fn() }
    // mirrors real AI SDK Experimental_VideoModelV3 (has doGenerate + maxVideosPerCall)
    const videoModel = {
      provider: 'google',
      modelId: 'veo-3.1-generate-preview',
      doGenerate: vi.fn(),
      maxVideosPerCall: 1,
    }

    expect(isCustomRestModel(customRest as never)).toBe(true)
    expect(isLanguageModel(languageModel as never)).toBe(true)
    expect(isImageModel(imageModel as never)).toBe(true)
    expect(isVideoModel(videoModel as never)).toBe(true)

    expect(isLanguageModel(customRest as never)).toBe(false)
    expect(isImageModel(languageModel as never)).toBe(false)
    expect(isVideoModel(imageModel as never)).toBe(false)
  })
})
