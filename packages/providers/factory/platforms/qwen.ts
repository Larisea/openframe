import { createAlibaba } from '@ai-sdk/alibaba'
import { stripTrailingSlash, bytesToDataUrl } from '@openframe/shared'
import { PROVIDER_BASE_URLS, PROVIDER_DEFAULT_MEDIA_OPTIONS, PROVIDER_IMAGE_RATIO_SIZE_MAP } from '../../constants'

export function createQwenTextModel(modelId: string, apiKey?: string, baseURL?: string) {
  const provider = createAlibaba({ apiKey, baseURL })
  return provider(modelId)
}

export function createQwenVideoModel(modelId: string, apiKey?: string, baseURL?: string) {
  // @ai-sdk/alibaba v1.0.4 routes video calls via `videoBaseURL` (NOT `baseURL`),
  // and appends '/api/v1/services/aigc/video-generation/video-synthesis' to it.
  // Strip a trailing '/api/v1' to avoid a duplicated path segment (would 404) and
  // pass the result as BOTH baseURL and videoBaseURL — otherwise video requests
  // silently fall back to https://dashscope-intl.aliyuncs.com and custom endpoints
  // (e.g. 业务空间专属域名 ws-*.maas.aliyuncs.com) are never used, causing
  // region-bound API keys to fail with 401 InvalidApiKey.
  const raw = stripTrailingSlash(baseURL || PROVIDER_BASE_URLS.qwenMedia)
  const normalized = raw.replace(/\/api\/v1$/i, '')
  return createAlibaba({ apiKey, baseURL: normalized, videoBaseURL: normalized }).video(modelId)
}

function toBaseUrl(baseURL?: string): string {
  return stripTrailingSlash(baseURL || PROVIDER_BASE_URLS.qwenMedia)
}

/** wan2.6-image uses multimodal-generation; wanx-v1 uses text2image (async) */
function isWan26ImageModel(modelId: string): boolean {
  return modelId.trim().toLowerCase() === 'wan2.6-image'
}

/** qwen-image-* series (qwen-image / qwen-image-2.1-pro / qwen-image-3.0 ...) use
 * multimodal-generation (sync), NOT text2image. Supports T2I and I2I (reference images). */
export function isQwenImageModel(modelId: string): boolean {
  return /^qwen-image/i.test(modelId.trim())
}

/** Convert a MediaReference to what multimodal-generation accepts: public URL or base64 data URI. */
function toImageRef(image: string | number[]): string {
  if (typeof image === 'string') return image
  return bytesToDataUrl(Array.from(image), 'image/png')
}

function extractImageUrlFromMultimodal(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const row = payload as Record<string, unknown>
  const output = row.output && typeof row.output === 'object' ? row.output as Record<string, unknown> : null
  const choices = Array.isArray(output?.choices) ? output.choices : []
  const firstChoice = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : null
  const message = firstChoice?.message && typeof firstChoice.message === 'object'
    ? firstChoice.message as Record<string, unknown>
    : null
  const content = Array.isArray(message?.content) ? message.content : []

  for (const item of content) {
    if (!item || typeof item !== 'object') continue
    const chunk = item as Record<string, unknown>
    for (const key of ['image', 'image_url', 'url']) {
      const value = chunk[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (value && typeof value === 'object') {
        const nested = value as Record<string, unknown>
        if (typeof nested.url === 'string' && nested.url.trim()) return nested.url.trim()
      }
    }
  }
  return null
}

function extractImageUrlFromText2Image(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const row = payload as Record<string, unknown>
  const output = row.output && typeof row.output === 'object' ? row.output as Record<string, unknown> : null
  const results = Array.isArray(output?.results) ? output.results : []
  const first = results[0] && typeof results[0] === 'object' ? results[0] as Record<string, unknown> : null
  return typeof first?.url === 'string' ? first.url : null
}

/** wanx-v1: text2image async API. Supports 1024*1024, 720*1280, 768*1152, 1280*720 */
const WANX_V1_SIZE_MAP: Record<string, string> = {
  '16:9': '1280*720',
  '9:16': '720*1280',
}

async function downloadImageBytes(url: string): Promise<{ data: number[]; mediaType: string; url: string }> {
  const fileRes = await fetch(url)
  if (!fileRes.ok) throw new Error(`Failed to download generated image: ${fileRes.status}`)
  const mediaType = fileRes.headers.get('content-type') || 'image/png'
  const bytes = new Uint8Array(await fileRes.arrayBuffer())
  return { data: Array.from(bytes), mediaType, url }
}

async function generateQwenImageWanxV1(args: {
  apiKey: string
  modelId: string
  prompt: string
  baseURL?: string
  size?: string
  ratio?: string
}): Promise<{ data: number[]; mediaType: string; url?: string }> {
  const base = toBaseUrl(args.baseURL)
  const mappedSize = args.ratio ? WANX_V1_SIZE_MAP[args.ratio] : undefined
  const size = args.size || mappedSize || '1024*1024'

  const url = `${base}/services/aigc/text2image/image-synthesis`
  const body = JSON.stringify({
    model: args.modelId,
    input: { prompt: args.prompt },
    parameters: { style: '<auto>', size, n: 1 },
  })
  const authHeaders = {
    'content-type': 'application/json',
    authorization: `Bearer ${args.apiKey}`,
  }

  // 1) 先按异步任务方式创建（wanx-v1 等异步模型）
  const createRes = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders, 'X-DashScope-Async': 'enable' },
    body,
  })
  const createText = await createRes.text().catch(() => '')

  if (createRes.ok) {
    const createPayload = createText ? JSON.parse(createText) as Record<string, unknown> : {}
    const taskId = (createPayload?.output as Record<string, unknown> | undefined)?.task_id as string | undefined

    if (taskId) {
      const maxAttempts = 60
      const pollIntervalMs = 2000

      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, pollIntervalMs))

        const pollRes = await fetch(`${base}/tasks/${taskId}`, {
          headers: { authorization: `Bearer ${args.apiKey}` },
        })
        const pollText = await pollRes.text().catch(() => '')
        if (!pollRes.ok) {
          throw new Error(pollText || `Qwen task poll failed: ${pollRes.status}`)
        }

        const pollPayload = pollText ? JSON.parse(pollText) as Record<string, unknown> : {}
        const output = pollPayload?.output as Record<string, unknown> | undefined
        const status = output?.task_status as string | undefined

        if (status === 'SUCCEEDED') {
          const imageUrl = extractImageUrlFromText2Image(pollPayload)
          if (!imageUrl) throw new Error('Qwen image task result missing image URL.')
          return downloadImageBytes(imageUrl)
        }

        if (status === 'FAILED' || status === 'CANCELED') {
          const msg = (output?.message as string) || status
          throw new Error(`Qwen image task ${status}: ${msg}`)
        }
      }

      throw new Error('Qwen image task timed out waiting for result.')
    }

    // 创建成功但未返回 task_id：部分服务端忽略异步头、直接同步返回结果
    const directUrl = extractImageUrlFromText2Image(createPayload)
    if (directUrl) return downloadImageBytes(directUrl)
    throw new Error('Qwen image task creation did not return task_id.')
  }

  // 2) 异步调用被拒绝（AccessDenied: not support asynchronous）→ 回退为同步调用
  const isAsyncDenied = /accessdenied/i.test(createText) && /asynchronous|async/i.test(createText)
  if (isAsyncDenied) {
    const syncRes = await fetch(url, {
      method: 'POST',
      headers: authHeaders,
      body,
    })
    const syncText = await syncRes.text().catch(() => '')
    if (!syncRes.ok) {
      throw new Error(syncText || `Qwen image generation failed: ${syncRes.status}`)
    }
    const syncPayload = syncText ? JSON.parse(syncText) as Record<string, unknown> : {}
    const syncUrl = extractImageUrlFromText2Image(syncPayload)
    if (!syncUrl) {
      throw new Error(`Qwen image generation failed: ${syncText.slice(0, 500)}`)
    }
    return downloadImageBytes(syncUrl)
  }

  throw new Error(createText || `Qwen image generation failed: ${createRes.status}`)
}

/**
 * wan2.6-image: multimodal-generation. For text-only (文生图), must use
 * enable_interleave=true + stream=true (SSE). Default enable_interleave=false
 * requires 1-4 reference images and causes "url error".
 */
async function generateQwenImageWan26(args: {
  apiKey: string
  modelId: string
  prompt: string
  baseURL?: string
  size?: string
  ratio?: string
}): Promise<{ data: number[]; mediaType: string; url?: string }> {
  const base = toBaseUrl(args.baseURL)
  const mappedSize =
    args.ratio === '16:9' || args.ratio === '9:16'
      ? PROVIDER_IMAGE_RATIO_SIZE_MAP.qwen[args.ratio]
      : undefined
  const size = args.size || mappedSize || PROVIDER_DEFAULT_MEDIA_OPTIONS.qwen.imageSize

  const url = `${base}/services/aigc/multimodal-generation/generation`
  const body = {
    model: args.modelId,
    input: {
      messages: [{ role: 'user', content: [{ text: args.prompt }] }],
    },
    parameters: {
      enable_interleave: true,
      stream: true,
      max_images: 1,
      size,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${args.apiKey}`,
      'X-DashScope-Sse': 'enable',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text().catch(() => '')
  if (!res.ok) {
    throw new Error(text || `Qwen image generation failed: ${res.status}`)
  }

  const parsed = parseImageUrlFromSseStream(text)
  if (!parsed.imageUrl) {
    const details = [...parsed.errors, ...parsed.texts].join(' | ')
    const structure = extractContentStructureFromMultimodal(text)
    throw new Error(details
      ? `Qwen image generation failed: ${details}`
      : `Qwen image generation response missing output image URL. Content structure: ${structure || '(no content array found)'}`)
  }

  const fileRes = await fetch(parsed.imageUrl)
  if (!fileRes.ok) {
    throw new Error(`Failed to download generated image: ${fileRes.status}`)
  }

  const mediaType = fileRes.headers.get('content-type') || 'image/png'
  const bytes = new Uint8Array(await fileRes.arrayBuffer())
  return { data: Array.from(bytes), mediaType, url: parsed.imageUrl }
}

/**
 * qwen-image-* series: sync multimodal-generation API.
 * Body uses input.messages[].content[] (text/image), NOT input.prompt.
 * Reference: aliyun model-studio qwen-image-generation-and-editing-api-reference
 */
async function generateQwenImageSyncMultimodal(args: {
  apiKey: string
  modelId: string
  prompt: string
  baseURL?: string
  size?: string
  ratio?: string
  referenceImages?: Array<string | number[]>
}): Promise<{ data: number[]; mediaType: string; url?: string }> {
  const base = toBaseUrl(args.baseURL)
  const mappedSize =
    args.ratio === '16:9' || args.ratio === '9:16'
      ? PROVIDER_IMAGE_RATIO_SIZE_MAP.qwen[args.ratio]
      : undefined
  const size = args.size || mappedSize || '1024*1024'

  const url = `${base}/services/aigc/multimodal-generation/generation`

  // T2I: content is only [{ text }]; I2I: 1-10 { image } entries first, then exactly one { text }
  const content: Array<Record<string, string>> = []
  for (const image of args.referenceImages ?? []) {
    content.push({ image: toImageRef(image) })
  }
  content.push({ text: args.prompt })

  const body = {
    model: args.modelId,
    input: {
      messages: [{ role: 'user', content }],
    },
    parameters: {
      prompt_extend: true,
      n: 1,
      size,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text().catch(() => '')
  if (!res.ok) {
    throw new Error(text || `Qwen image generation failed: ${res.status}`)
  }

  let payload: Record<string, unknown>
  try {
    payload = text ? JSON.parse(text) as Record<string, unknown> : {}
  } catch {
    throw new Error(`Qwen image generation failed to parse response: ${text.slice(0, 500)}`)
  }

  const imageUrl = extractImageUrlFromMultimodal(payload)
  if (!imageUrl) {
    throw new Error(`Qwen image generation response missing output image URL. Content: ${text.slice(0, 500)}`)
  }
  return downloadImageBytes(imageUrl)
}

function extractContentStructureFromMultimodal(text: string): string {
  const parts: string[] = []
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (data === '[DONE]') continue
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>
      const output = parsed.output && typeof parsed.output === 'object'
        ? parsed.output as Record<string, unknown>
        : null
      const choices = Array.isArray(output?.choices) ? output.choices : []
      const firstChoice = choices[0] && typeof choices[0] === 'object'
        ? choices[0] as Record<string, unknown>
        : null
      const message = firstChoice?.message && typeof firstChoice.message === 'object'
        ? firstChoice.message as Record<string, unknown>
        : null
      const content = Array.isArray(message?.content) ? message.content : []
      if (content.length > 0) {
        parts.push(JSON.stringify(content).slice(0, 400))
      }
    } catch {
      // skip invalid JSON chunks
    }
  }
  return parts.join(' || ')
}

function parseImageUrlFromSseStream(sseText: string): {
  imageUrl: string | null
  errors: string[]
  texts: string[]
} {
  const lines = sseText.split('\n')
  let imageUrl: string | null = null
  const errors: string[] = []
  const texts: string[] = []

  for (const line of lines) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (data === '[DONE]') continue
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>
      const url = extractImageUrlFromMultimodal(parsed)
      if (url) imageUrl = url

      const output = parsed.output && typeof parsed.output === 'object'
        ? parsed.output as Record<string, unknown>
        : null
      if (output) {
        const errorText = typeof output.message === 'string'
          ? output.message
          : typeof output.error === 'string'
            ? output.error
            : null
        if (errorText) errors.push(errorText)

        const choices = Array.isArray(output.choices) ? output.choices : []
        for (const choice of choices) {
          if (!choice || typeof choice !== 'object') continue
          const row = choice as Record<string, unknown>
          const message = row.message && typeof row.message === 'object'
            ? row.message as Record<string, unknown>
            : null
          const content = Array.isArray(message?.content) ? message.content : []
          for (const item of content) {
            if (!item || typeof item !== 'object') continue
            const chunk = item as Record<string, unknown>
            const chunkText = typeof chunk.text === 'string' ? chunk.text.trim() : ''
            if (chunkText) texts.push(chunkText)
          }
        }
      }
    } catch {
      // skip invalid JSON chunks
    }
  }

  return { imageUrl, errors, texts }
}

export async function generateQwenImage(args: {
  apiKey: string
  modelId: string
  prompt: string
  baseURL?: string
  size?: string
  ratio?: string
  referenceImages?: Array<string | number[]>
}): Promise<{ data: number[]; mediaType: string; url?: string }> {
  const modelId = args.modelId.trim()
  const hasRefs = Array.isArray(args.referenceImages) && args.referenceImages.length > 0

  // qwen-image-* series: multimodal-generation (sync), supports both T2I and I2I (reference images)
  if (isQwenImageModel(modelId)) {
    return generateQwenImageSyncMultimodal(args)
  }

  // wanx-v1 / wan2.6-image branches are text-only in this adapter
  if (hasRefs) {
    throw new Error('Qwen image API currently supports text prompt only in this adapter.')
  }

  if (isWan26ImageModel(modelId)) {
    return generateQwenImageWan26(args)
  }
  return generateQwenImageWanxV1(args)
}
