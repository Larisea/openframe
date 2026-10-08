import { PROVIDER_BASE_URLS } from './constants'

export type ModelType = 'text' | 'image' | 'video' | 'embedding'

export interface ModelDef {
  id: string
  name: string
  type: ModelType
  /** Output dimension — only set for embedding models */
  dimension?: number
}

export interface ProviderDef {
  id: string
  /** Package name from Vercel AI SDK, undefined = custom REST */
  sdkPackage?: string
  name: string
  models: ModelDef[]
  /** Provider authenticates via base URL only, no API key required */
  noApiKey?: boolean
  /** Default base URL shown as placeholder and used as fallback */
  defaultBaseUrl?: string
}

export interface CustomProviderDef {
  id: string
  name: string
  /** Provider authenticates via base URL only, no API key required */
  noApiKey?: boolean
  /** Default base URL shown as placeholder and used as fallback */
  defaultBaseUrl?: string
}

// ── Official Vercel AI SDK providers ─────────────────────────────────────────

export const AI_PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    sdkPackage: '@ai-sdk/openai',
    name: 'OpenAI',
    defaultBaseUrl: PROVIDER_BASE_URLS.openai,
    models: [
      { id: 'gpt-4o',       name: 'GPT-4o',       type: 'text' },
      { id: 'gpt-4o-mini',  name: 'GPT-4o mini',  type: 'text' },
      { id: 'o3-mini',      name: 'o3 mini',       type: 'text' },
      { id: 'o1',           name: 'o1',            type: 'text' },
      { id: 'gpt-image-1',      name: 'GPT Image 1',      type: 'image' },
      { id: 'gpt-image-1-mini', name: 'GPT Image 1 mini', type: 'image' },
      { id: 'gpt-image-1.5',    name: 'GPT Image 1.5',    type: 'image' },
      { id: 'dall-e-3',     name: 'DALL·E 3',      type: 'image' },
      { id: 'dall-e-2',     name: 'DALL·E 2',      type: 'image' },
      { id: 'text-embedding-3-small', name: 'text-embedding-3-small', type: 'embedding', dimension: 1536 },
      { id: 'text-embedding-3-large', name: 'text-embedding-3-large', type: 'embedding', dimension: 3072 },
      { id: 'text-embedding-ada-002', name: 'text-embedding-ada-002', type: 'embedding', dimension: 1536 },
    ],
  },
  {
    id: 'anthropic',
    sdkPackage: '@ai-sdk/anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-opus-4-5',   name: 'Claude Opus 4.5',   type: 'text' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', type: 'text' },
      { id: 'claude-haiku-3-5',  name: 'Claude Haiku 3.5',  type: 'text' },
    ],
  },
  {
    id: 'google',
    sdkPackage: '@ai-sdk/google',
    name: 'Google',
    models: [
      { id: 'gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro',    type: 'text' },
      { id: 'gemini-2.0-flash',       name: 'Gemini 2.0 Flash',  type: 'text' },
      { id: 'gemini-1.5-pro',         name: 'Gemini 1.5 Pro',    type: 'text' },
      { id: 'gemini-1.5-flash',       name: 'Gemini 1.5 Flash',  type: 'text' },
      { id: 'nano-banana-pro',        name: 'Nano Banana Pro (alias)', type: 'image' },
      { id: 'gemini-2.5-flash-image', name: 'Nano Banana (Gemini 2.5 Flash Image)', type: 'image' },
      { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image Preview', type: 'image' },
      { id: 'imagen-3',               name: 'Imagen 3',          type: 'image' },
      { id: 'veo3', name: 'Veo 3 (alias)', type: 'video' },
      { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast (Preview)', type: 'video' },
      { id: 'veo-3.1-generate-preview', name: 'Veo 3.1 (Preview)', type: 'video' },
      { id: 'veo-3.1-generate', name: 'Veo 3.1', type: 'video' },
      { id: 'veo-2.0-generate-001', name: 'Veo 2.0', type: 'video' },
    ],
  },
  {
    id: 'xai',
    sdkPackage: '@ai-sdk/xai',
    name: 'xAI Grok',
    models: [
      { id: 'grok-2-1212',        name: 'Grok 2',            type: 'text' },
      { id: 'grok-2-vision-1212', name: 'Grok 2 Vision',     type: 'text' },
      { id: 'grok-beta',          name: 'Grok Beta',         type: 'text' },
    ],
  },
  {
    id: 'azure',
    sdkPackage: '@ai-sdk/azure',
    name: 'Azure OpenAI',
    models: [
      { id: 'gpt-4o',      name: 'GPT-4o',      type: 'text' },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', type: 'text' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', type: 'text' },
    ],
  },
  {
    id: 'mistral',
    sdkPackage: '@ai-sdk/mistral',
    name: 'Mistral',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large',  type: 'text' },
      { id: 'mistral-small-latest', name: 'Mistral Small',  type: 'text' },
      { id: 'codestral-latest',     name: 'Codestral',      type: 'text' },
    ],
  },
  {
    id: 'groq',
    sdkPackage: '@ai-sdk/groq',
    name: 'Groq',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B',   type: 'text' },
      { id: 'llama-3.1-8b-instant',    name: 'Llama 3.1 8B',    type: 'text' },
      { id: 'gemma2-9b-it',            name: 'Gemma 2 9B',      type: 'text' },
      { id: 'qwen-qwq-32b',            name: 'Qwen QwQ 32B',    type: 'text' },
    ],
  },
  {
    id: 'deepseek',
    sdkPackage: '@ai-sdk/deepseek',
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat',     name: 'DeepSeek V3',       type: 'text' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1',       type: 'text' },
    ],
  },
  {
    id: 'togetherai',
    sdkPackage: '@ai-sdk/togetherai',
    name: 'Together.ai',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', type: 'text' },
      { id: 'deepseek-ai/DeepSeek-R1',                 name: 'DeepSeek R1',          type: 'text' },
      { id: 'Qwen/QwQ-32B-Preview',                    name: 'Qwen QwQ 32B',         type: 'text' },
      { id: 'black-forest-labs/FLUX.1.1-pro',          name: 'FLUX 1.1 Pro',         type: 'image' },
    ],
  },
  {
    id: 'perplexity',
    sdkPackage: '@ai-sdk/perplexity',
    name: 'Perplexity',
    models: [
      { id: 'sonar-pro',   name: 'Sonar Pro',  type: 'text' },
      { id: 'sonar',       name: 'Sonar',      type: 'text' },
      { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', type: 'text' },
    ],
  },
  {
    id: 'qwen',
    sdkPackage: '@ai-sdk/alibaba',
    name: 'Qwen',
    defaultBaseUrl: PROVIDER_BASE_URLS.qwen,
    models: [
      { id: 'qwen3-max',       name: 'Qwen3 Max',      type: 'text' },
      { id: 'qwen-plus',       name: 'Qwen Plus',      type: 'text' },
      { id: 'qwen-turbo',      name: 'Qwen Turbo',     type: 'text' },
      { id: 'qwq-32b',         name: 'QwQ 32B',        type: 'text' },
      { id: 'wanx-v1',         name: 'Wanxiang v1',    type: 'image' },
      { id: 'wan2.5-t2v-preview', name: 'Wan2.5 T2V Preview', type: 'video' },
      { id: 'wan2.6-t2v',      name: 'Wan2.6 T2V',     type: 'video' },
      { id: 'wan2.6-i2v',      name: 'Wan2.6 I2V',     type: 'video' },
      { id: 'wan2.6-i2v-flash', name: 'Wan2.6 I2V Flash', type: 'video' },
      { id: 'wan2.6-r2v',      name: 'Wan2.6 R2V',     type: 'video' },
      { id: 'wan2.6-r2v-flash', name: 'Wan2.6 R2V Flash', type: 'video' },
      { id: 'wan3.0-video-prime', name: 'Wan3.0 Video Prime', type: 'video' },
    ],
  },
  {
    id: 'zhipu',
    sdkPackage: '@ai-sdk/openai-compatible',
    name: 'Zhipu AI',
    models: [
      { id: 'glm-4',          name: 'GLM-4',          type: 'text' },
      { id: 'glm-4-flash',    name: 'GLM-4 Flash',    type: 'text' },
      { id: 'glm-4-air',      name: 'GLM-4 Air',      type: 'text' },
      { id: 'glm-4v',         name: 'GLM-4V',         type: 'text' },
      { id: 'cogview-3-plus', name: 'CogView-3 Plus', type: 'image' },
    ],
  },
  {
    id: 'volcengine',
    sdkPackage: '@ai-sdk/openai-compatible',
    name: 'Volcengine',
    defaultBaseUrl: PROVIDER_BASE_URLS.volcengine,
    models: [
      { id: 'doubao-1.5-pro-32k',  name: 'Doubao 1.5 Pro 32K',  type: 'text' },
      { id: 'doubao-1.5-lite-32k', name: 'Doubao 1.5 Lite 32K', type: 'text' },
      { id: 'doubao-1.5-pro-256k', name: 'Doubao 1.5 Pro 256K', type: 'text' },
      { id: 'doubao-seed-1.6',     name: 'Doubao Seed 1.6',     type: 'text' },
      { id: 'deepseek-r1-250120',  name: 'DeepSeek R1',         type: 'text' },
      { id: 'deepseek-v3-250324',  name: 'DeepSeek V3',         type: 'text' },
      { id: 'doubao-embedding-large', name: 'Doubao Embedding Large', type: 'embedding', dimension: 2048 },
    ],
  },
  {
    id: 'ollama',
    sdkPackage: '@ai-sdk/openai-compatible',
    name: 'Ollama',
    noApiKey: true,
    defaultBaseUrl: PROVIDER_BASE_URLS.ollama,
    models: [
      { id: 'llama3.2:3b',            name: 'Llama 3.2 3B',      type: 'text' },
      { id: 'llama3.1:8b',            name: 'Llama 3.1 8B',      type: 'text' },
      { id: 'qwen2.5:7b',             name: 'Qwen 2.5 7B',       type: 'text' },
      { id: 'qwen2.5:14b',            name: 'Qwen 2.5 14B',      type: 'text' },
      { id: 'deepseek-r1:7b',         name: 'DeepSeek R1 7B',    type: 'text' },
      { id: 'deepseek-r1:14b',        name: 'DeepSeek R1 14B',   type: 'text' },
      { id: 'mistral:7b',             name: 'Mistral 7B',        type: 'text' },
      { id: 'gemma3:4b',              name: 'Gemma 3 4B',        type: 'text' },
      { id: 'phi4:14b',               name: 'Phi 4 14B',         type: 'text' },
      { id: 'nomic-embed-text:latest', name: 'nomic-embed-text',  type: 'embedding', dimension: 768  },
      { id: 'mxbai-embed-large:latest', name: 'mxbai-embed-large', type: 'embedding', dimension: 1024 },
      { id: 'bge-m3:latest',           name: 'bge-m3',            type: 'embedding', dimension: 1024 },
      { id: 'all-minilm:latest',       name: 'all-minilm',        type: 'embedding', dimension: 384  },
    ],
  },
]

const BUILTIN_PROVIDER_IDS = new Set(AI_PROVIDERS.map((provider) => provider.id))

function normalizeCustomProvider(provider: CustomProviderDef): ProviderDef | null {
  const id = provider.id.trim()
  if (!id) return null
  const name = provider.name.trim() || id
  const defaultBaseUrl = provider.defaultBaseUrl?.trim()
  return {
    id,
    name,
    models: [],
    ...(provider.noApiKey ? { noApiKey: true } : {}),
    ...(defaultBaseUrl ? { defaultBaseUrl } : {}),
  }
}

export function isBuiltInProvider(providerId: string): boolean {
  return BUILTIN_PROVIDER_IDS.has(providerId)
}

export function getAllProviders(customProviders: CustomProviderDef[] = []): ProviderDef[] {
  if (!customProviders.length) return AI_PROVIDERS

  const seen = new Set(BUILTIN_PROVIDER_IDS)
  const custom: ProviderDef[] = []

  for (const provider of customProviders) {
    const normalized = normalizeCustomProvider(provider)
    if (!normalized) continue
    if (seen.has(normalized.id)) continue
    seen.add(normalized.id)
    custom.push(normalized)
  }

  return [...AI_PROVIDERS, ...custom]
}

export function getProviderById(
  providerId: string,
  customProviders: CustomProviderDef[] = [],
): ProviderDef | undefined {
  return getAllProviders(customProviders).find((provider) => provider.id === providerId)
}
