import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, X, Plus, Upload, Download, CheckCircle, XCircle, Loader, PencilLine, Check, Trash2, SlidersHorizontal } from 'lucide-react'
import {
  getAllProviders,
  getProviderById,
  isBuiltInProvider,
  providerColor,
  getSelectableModelsByType,
  getEnabledProviderModels,
  getVisibleProviderModels,
  PROVIDER_BASE_URLS,
  type AIConfig,
  type ModelDef,
  type ModelType,
  type ProviderDef,
} from '@openframe/providers'

// ── Provider avatar ────────────────────────────────────────────────────────────

const providerLogoUrls = import.meta.glob(
  '../../assets/providers/*.svg',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

function getLogoUrl(id: string): string | undefined {
  return providerLogoUrls[`../../assets/providers/${id}.svg`]
}

function ProviderAvatar({ id, name, size = 24 }: { id: string; name: string; size?: number }) {
  const logoUrl = getLogoUrl(id)
  const px = size
  const iconPx = Math.round(size * 0.6)

  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: px, height: px, background: providerColor(id) }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          style={{ width: iconPx, height: iconPx, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
        />
      ) : (
        <span className="text-white font-bold" style={{ fontSize: Math.round(size * 0.4) }}>
          {name[0].toUpperCase()}
        </span>
      )}
    </div>
  )
}

const DEFAULT_MODEL_TYPES: { type: ModelType; labelKey: string }[] = [
  { type: 'text',  labelKey: 'settings.aiTextModel'  },
  { type: 'image', labelKey: 'settings.aiImageModel' },
  { type: 'video', labelKey: 'settings.aiVideoModel' },
]

const MODEL_TYPE_SECTIONS: { type: ModelType; labelKey: string }[] = [
  { type: 'text', labelKey: 'settings.aiTextModel' },
  { type: 'image', labelKey: 'settings.aiImageModel' },
  { type: 'video', labelKey: 'settings.aiVideoModel' },
]

function normalizeProviderId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-')
}

function omitRecordKey<T extends Record<string, unknown>>(record: T, key: string): T {
  const next = { ...record }
  delete next[key]
  return next
}

function omitModelKeysByProvider(record: Record<string, boolean>, providerId: string): Record<string, boolean> {
  const prefix = `${providerId}:`
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !key.startsWith(prefix)),
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

interface AISettingsPanelProps {
  config: AIConfig
  onChange: (c: AIConfig) => void
}

type ProviderRuntimeConfig = {
  apiKey: string
  baseUrl: string
  baseUrlText: string
  baseUrlImage: string
  baseUrlVideo: string
  enabled: boolean
}

function normalizeProviderRuntimeConfig(raw: AIConfig['providers'][string] | undefined): ProviderRuntimeConfig {
  const baseUrl = raw?.baseUrl ?? ''
  return {
    apiKey: raw?.apiKey ?? '',
    baseUrl,
    baseUrlText: raw?.baseUrlText ?? baseUrl,
    baseUrlImage: raw?.baseUrlImage ?? '',
    baseUrlVideo: raw?.baseUrlVideo ?? '',
    enabled: raw?.enabled === true,
  }
}

function getBaseUrlPlaceholder(provider: ProviderDef, type: 'text' | 'image' | 'video', fallback: string): string {
  if (provider.id === 'qwen' && (type === 'image' || type === 'video')) {
    return PROVIDER_BASE_URLS.qwenMedia
  }
  return provider.defaultBaseUrl ?? fallback
}

export function AISettingsPanel({ config, onChange }: AISettingsPanelProps) {
  const { t } = useTranslation()
  const DEFAULT_MODELS_ID = '__default_models__' as const
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(DEFAULT_MODELS_ID)
  const [addingProvider, setAddingProvider] = useState(false)
  const [addProviderError, setAddProviderError] = useState('')
  const [newProvider, setNewProvider] = useState<{
    id: string
    name: string
    defaultBaseUrl: string
    noApiKey: boolean
  }>({
    id: '',
    name: '',
    defaultBaseUrl: '',
    noApiKey: false,
  })

  const allProviders = useMemo(
    () => getAllProviders(config.customProviders),
    [config.customProviders],
  )

  useEffect(() => {
    if (!selectedProviderId || selectedProviderId === DEFAULT_MODELS_ID) return
    if (!allProviders.some((provider) => provider.id === selectedProviderId)) {
      setSelectedProviderId(DEFAULT_MODELS_ID)
    }
  }, [allProviders, selectedProviderId])

  function updateProvider(
    providerId: string,
    patch: Partial<ProviderRuntimeConfig>,
  ) {
    const prev = normalizeProviderRuntimeConfig(config.providers[providerId])
    const next = { ...prev, ...patch }
    if ('baseUrlText' in patch || 'baseUrlImage' in patch || 'baseUrlVideo' in patch) {
      next.baseUrl = next.baseUrlText
    }
    onChange({
      ...config,
      providers: { ...config.providers, [providerId]: next },
    })
  }

  function handleAddProvider() {
    const id = normalizeProviderId(newProvider.id)
    const name = newProvider.name.trim()
    const defaultBaseUrl = newProvider.defaultBaseUrl.trim()

    if (!id || !name) {
      setAddProviderError(t('settings.aiProviderRequired'))
      return
    }
    if (allProviders.some((provider) => provider.id === id)) {
      setAddProviderError(t('settings.aiProviderExists'))
      return
    }

    onChange({
      ...config,
      customProviders: [
        ...(config.customProviders ?? []),
        {
          id,
          name,
          ...(newProvider.noApiKey ? { noApiKey: true } : {}),
          ...(defaultBaseUrl ? { defaultBaseUrl } : {}),
        },
      ],
      providers: {
        ...config.providers,
        [id]: config.providers[id] ?? {
          apiKey: '',
          baseUrl: '',
          baseUrlText: '',
          baseUrlImage: '',
          baseUrlVideo: '',
          enabled: false,
        },
      },
    })

    setSelectedProviderId(id)
    setAddingProvider(false)
    setAddProviderError('')
    setNewProvider({ id: '', name: '', defaultBaseUrl: '', noApiKey: false })
  }

  function removeProvider(providerId: string) {
    const provider = allProviders.find((item) => item.id === providerId)
    if (!window.confirm(t('settings.aiRemoveProviderConfirm', { name: provider?.name ?? providerId }))) return

    const nextModels = { ...config.models }
    if (nextModels.text.startsWith(`${providerId}:`)) nextModels.text = ''
    if (nextModels.image.startsWith(`${providerId}:`)) nextModels.image = ''
    if (nextModels.video.startsWith(`${providerId}:`)) nextModels.video = ''
    if (nextModels.embedding.startsWith(`${providerId}:`)) nextModels.embedding = ''

    onChange({
      ...config,
      providers: omitRecordKey(config.providers, providerId),
      customProviders: (config.customProviders ?? []).filter((item) => item.id !== providerId),
      customModels: omitRecordKey(config.customModels, providerId),
      enabledModels: omitModelKeysByProvider(config.enabledModels, providerId),
      hiddenModels: omitModelKeysByProvider(config.hiddenModels, providerId),
      models: nextModels,
    })
    setSelectedProviderId(DEFAULT_MODELS_ID)
  }

  const selectedProvider =
    selectedProviderId && selectedProviderId !== DEFAULT_MODELS_ID
      ? allProviders.find((provider) => provider.id === selectedProviderId) ?? null
      : null
  const selectedProviderIsCustom = !!selectedProvider && !isBuiltInProvider(selectedProvider.id)

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Provider List ── */}
      <div className="w-56 shrink-0 border-r border-base-300 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            {t('settings.aiProviders')}
          </span>
          <div className="flex gap-0.5">
            <button
              className="btn btn-ghost btn-xs px-1.5"
              title={t('settings.aiAddProvider')}
              onClick={() => {
                setAddingProvider((value) => !value)
                setAddProviderError('')
                setNewProvider({ id: '', name: '', defaultBaseUrl: '', noApiKey: false })
              }}
            >
              <Plus size={12} />
            </button>
            <button className="btn btn-ghost btn-xs px-1.5" title={t('settings.aiImport')}>
              <Upload size={12} />
            </button>
            <button className="btn btn-ghost btn-xs px-1.5" title={t('settings.aiExport')}>
              <Download size={12} />
            </button>
          </div>
        </div>

        {addingProvider && (
          <div className="px-3 py-2 border-b border-base-300 flex flex-col gap-1.5 bg-base-100">
            <input
              className="input input-bordered input-xs font-mono"
              placeholder={t('settings.aiProviderIdPlaceholder')}
              value={newProvider.id}
              onChange={(e) => {
                setAddProviderError('')
                setNewProvider((prev) => ({ ...prev, id: e.target.value }))
              }}
              autoFocus
            />
            <input
              className="input input-bordered input-xs"
              placeholder={t('settings.aiProviderNamePlaceholder')}
              value={newProvider.name}
              onChange={(e) => {
                setAddProviderError('')
                setNewProvider((prev) => ({ ...prev, name: e.target.value }))
              }}
            />
            <input
              className="input input-bordered input-xs"
              placeholder={t('settings.aiBaseUrlPlaceholder')}
              value={newProvider.defaultBaseUrl}
              onChange={(e) => {
                setAddProviderError('')
                setNewProvider((prev) => ({ ...prev, defaultBaseUrl: e.target.value }))
              }}
            />
            <label className="label cursor-pointer px-0 min-h-0 h-auto justify-start gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-xs"
                checked={newProvider.noApiKey}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, noApiKey: e.target.checked }))}
              />
              <span className="label-text text-xs">{t('settings.aiProviderNoApiKey')}</span>
            </label>
            {addProviderError ? (
              <p className="text-[11px] text-error">{addProviderError}</p>
            ) : null}
            <div className="flex justify-end gap-1">
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => {
                  setAddingProvider(false)
                  setAddProviderError('')
                }}
              >
                {t('settings.cancel')}
              </button>
              <button className="btn btn-primary btn-xs" onClick={handleAddProvider}>
                {t('settings.aiAddProvider')}
              </button>
            </div>
          </div>
        )}

        {/* Default Models + Provider items */}
        <div className="flex-1 overflow-auto py-1">
          <button
            className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-base-200 transition-colors text-left ${
              selectedProviderId === DEFAULT_MODELS_ID ? 'bg-base-200' : ''
            }`}
            onClick={() => setSelectedProviderId(DEFAULT_MODELS_ID)}
          >
            <SlidersHorizontal size={20} className="shrink-0 text-base-content/60" />
            <span className="flex-1 text-sm truncate">{t('settings.aiModels')}</span>
          </button>
          {allProviders.map((provider) => {
            const cfg = normalizeProviderRuntimeConfig(config.providers[provider.id])
            const isSelected = selectedProviderId === provider.id

            return (
              <button
                key={provider.id}
                className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-base-200 transition-colors text-left ${
                  isSelected ? 'bg-base-200' : ''
                }`}
                onClick={() => setSelectedProviderId(provider.id)}
              >
                {/* Avatar */}
                <ProviderAvatar id={provider.id} name={provider.name} size={24} />
                {/* Name */}
                <span className="flex-1 text-sm truncate">{provider.name}</span>
                {/* Toggle */}
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-xs shrink-0"
                  checked={cfg.enabled}
                  onChange={(e) => {
                    e.stopPropagation()
                    updateProvider(provider.id, { enabled: e.target.checked })
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right: Provider Detail or Default Models ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedProvider == null || selectedProviderId === DEFAULT_MODELS_ID ? (
          <DefaultModelsPanel config={config} onChange={onChange} />
        ) : (
          <ProviderDetail
            key={selectedProvider.id}
            provider={selectedProvider}
            config={config}
            onChange={onChange}
            isCustomProvider={selectedProviderIsCustom}
            onRemoveProvider={selectedProviderIsCustom ? () => removeProvider(selectedProvider.id) : undefined}
          />
        )}
      </div>

    </div>
  )
}

// ── Default Models Panel ───────────────────────────────────────────────────────

function DefaultModelsPanel({ config, onChange }: { config: AIConfig; onChange: (c: AIConfig) => void }) {
  const { t } = useTranslation()

  function updateModel(type: ModelType, value: string) {
    onChange({ ...config, models: { ...config.models, [type]: value } })
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-6 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold">{t('settings.aiModels')}</span>
        <span className="text-xs text-base-content/50">{t('settings.aiSelectProviderHint')}</span>
      </div>

      <div className="flex flex-col gap-3">
        {DEFAULT_MODEL_TYPES.map(({ type, labelKey }) => (
          <div key={type} className="flex items-center justify-between gap-4">
            <span className="text-sm shrink-0">{t(labelKey)}</span>
            <select
              className="select select-bordered flex-1 max-w-64"
              value={config.models[type]}
              onChange={(e) => updateModel(type, e.target.value)}
            >
              <option value="">{t('settings.aiNoModel')}</option>
              {getSelectableModelsByType(config, type).map(({ provider, models }) => {
                return (
                  <optgroup key={provider.id} label={provider.name}>
                    {models.map((m) => {
                      return (
                        <option key={m.id} value={`${provider.id}:${m.id}`}>
                          {m.name}
                        </option>
                      )
                    })}
                  </optgroup>
                )
              })}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MediaConcurrencyPanel({ config, onChange }: { config: AIConfig; onChange: (c: AIConfig) => void }) {
  const { t } = useTranslation()

  function updateConcurrency(type: 'image' | 'video', value: string) {
    const next = Math.max(1, Math.min(20, Number.parseInt(value || '1', 10) || 1))
    onChange({
      ...config,
      concurrency: {
        image: config.concurrency?.image ?? 5,
        video: config.concurrency?.video ?? 5,
        [type]: next,
      },
    })
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-6 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold">{t('settings.aiMediaConcurrency')}</span>
        <span className="text-xs text-base-content/50">{t('settings.aiMediaConcurrencyHint')}</span>
      </div>

      <div className="flex flex-col gap-3 border border-base-300 rounded-xl p-4 bg-base-100">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm shrink-0">{t('settings.aiImageConcurrency')}</span>
          <select
            className="select select-bordered w-28"
            value={config.concurrency?.image ?? 5}
            onChange={(e) => updateConcurrency('image', e.target.value)}
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm shrink-0">{t('settings.aiVideoConcurrency')}</span>
          <select
            className="select select-bordered w-28"
            value={config.concurrency?.video ?? 5}
            onChange={(e) => updateConcurrency('video', e.target.value)}
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-base-content/50">{t('settings.aiConcurrencyRange')}</div>
      </div>
    </div>
  )
}

// ── Embedding Panel ────────────────────────────────────────────────────────────

export function EmbeddingPanel({ config, onChange }: { config: AIConfig; onChange: (c: AIConfig) => void }) {
  const { t } = useTranslation()
  const [storedDim, setStoredDim] = useState<number>(0)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const allProviders = useMemo(
    () => getAllProviders(config.customProviders),
    [config.customProviders],
  )

  useEffect(() => {
    window.vectorsAPI.getDimension().then(setStoredDim)
  }, [])

  const selectedKey = config.models.embedding

  function getDimForKey(key: string): number | undefined {
    const [providerId, modelId] = key.split(':')
    const provider = getProviderById(providerId, config.customProviders)
    const builtin = provider?.models.find((m) => m.id === modelId)
    if (builtin?.dimension) return builtin.dimension
    const custom = (config.customModels[providerId] ?? []).find((m) => m.id === modelId)
    return (custom as ModelDef)?.dimension
  }

  function handleSelectModel(key: string) {
    const newDim = getDimForKey(key)
    if (newDim && storedDim > 0 && newDim !== storedDim) {
      setConfirmKey(key)
    } else {
      onChange({ ...config, models: { ...config.models, embedding: key } })
      if (newDim) setStoredDim(newDim)
    }
  }

  function confirmSwitch() {
    if (!confirmKey) return
    const newDim = getDimForKey(confirmKey)
    onChange({ ...config, models: { ...config.models, embedding: confirmKey } })
    if (newDim) setStoredDim(newDim)
    setConfirmKey(null)
  }

  const confirmDim = confirmKey ? getDimForKey(confirmKey) : undefined

  const availableProviders = allProviders.filter(
    (provider) =>
      !!config.providers[provider.id]?.enabled
      && getEnabledProviderModels(provider.id, config, 'embedding').length > 0,
  )

  return (
    <div className="h-full overflow-auto px-6 py-5 flex flex-col gap-3">

      {/* Current dimension badge */}
      {storedDim > 0 && (
        <div className="flex items-center gap-2 pb-1 border-b border-base-200">
          <span className="text-xs text-base-content/50">{t('settings.aiEmbeddingCurrentDim', { dim: storedDim })}</span>
        </div>
      )}

      {availableProviders.length === 0 ? (
        <div className="flex flex-col gap-1 py-4">
          <p className="text-sm text-base-content/60">{t('settings.aiEmbeddingNone')}</p>
          <p className="text-xs text-base-content/40">{t('settings.aiEmbeddingEnableHint')}</p>
        </div>
      ) : (
        availableProviders.map((provider) => {
          const embeddingModels = getEnabledProviderModels(provider.id, config, 'embedding')
          return (
            <div key={provider.id} className="flex flex-col">
              {/* Provider label */}
              <div className="flex items-center gap-2 px-2 py-1.5 mb-0.5">
                <ProviderAvatar id={provider.id} name={provider.name} size={18} />
                <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">
                  {provider.name}
                </span>
              </div>

              {/* Clickable model rows */}
              {embeddingModels.map((m) => {
                const key = `${provider.id}:${m.id}`
                const isSelected = selectedKey === key
                const dim = m.dimension
                const dimConflict = dim && storedDim > 0 && dim !== storedDim
                return (
                  <button
                    key={m.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-base-200'
                    }`}
                    onClick={() => handleSelectModel(key)}
                  >
                    <span
                      className="shrink-0 w-2.5 h-2.5 rounded-full border-2 transition-colors"
                      style={{
                        borderColor: isSelected ? 'var(--color-primary)' : '#9ca3af',
                        background: isSelected ? 'var(--color-primary)' : 'transparent',
                      }}
                    />
                    <span className="flex-1 text-sm font-mono">{m.name}</span>
                    {dim && (
                      <span className={`text-xs shrink-0 ${dimConflict ? 'text-warning' : 'text-base-content/40'}`}>
                        {t('settings.aiEmbeddingDimension', { dim })}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })
      )}

      {/* Dimension conflict confirm dialog */}
      {confirmKey && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-warning mb-3">{t('settings.aiEmbeddingDimConflict')}</h3>
            <p className="text-sm text-base-content/70">
              {t('settings.aiEmbeddingDimConflictMsg', { from: storedDim, to: confirmDim })}
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmKey(null)}>
                {t('settings.cancel')}
              </button>
              <button className="btn btn-error btn-sm" onClick={confirmSwitch}>
                {t('settings.aiEmbeddingConfirmSwitch')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setConfirmKey(null)} />
        </dialog>
      )}
    </div>
  )
}

// ── Provider Detail Panel ──────────────────────────────────────────────────────

function typeBadgeClass(type: ModelType): string {
  if (type === 'text')      return 'badge-info'
  if (type === 'image')     return 'badge-warning'
  if (type === 'embedding') return 'badge-accent'
  return 'badge-secondary'
}

interface ProviderDetailProps {
  provider: ProviderDef
  config: AIConfig
  onChange: (c: AIConfig) => void
  isCustomProvider?: boolean
  onRemoveProvider?: () => void
}

type TestState = 'idle' | 'testing' | 'ok' | 'error'

function ProviderDetail({
  provider,
  config,
  onChange,
  isCustomProvider = false,
  onRemoveProvider,
}: ProviderDetailProps) {
  const { t } = useTranslation()
  const [showKey, setShowKey] = useState(false)
  const [addingModel, setAddingModel] = useState(false)
  const [newModel, setNewModel] = useState<{ id: string; name: string; type: ModelType; dimension?: number }>({
    id: '', name: '', type: 'text',
  })
  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [editModel, setEditModel] = useState<{ id: string; name: string; type: ModelType; dimension?: number }>({
    id: '', name: '', type: 'text',
  })
  const [testState, setTestState] = useState<TestState>('idle')
  const [testError, setTestError] = useState<string>('')
  const [testModelId, setTestModelId] = useState<string>('')

  const cfg = normalizeProviderRuntimeConfig(config.providers[provider.id])
  const customModels = config.customModels[provider.id] ?? []
  const visibleModels = getVisibleProviderModels(provider.id, config)
    .filter((model) => model.type !== 'embedding')
  const enabledTestModels = getEnabledProviderModels(provider.id, config)
    .filter((model) => model.type !== 'embedding')
  /** Connection test only supports text models (lightweight API call) */
  const testableModels = enabledTestModels.filter((m) => m.type === 'text')
  const hasEnabledTestModels = testableModels.length > 0
  const modelsByType = MODEL_TYPE_SECTIONS.map(({ type, labelKey }) => ({
    type,
    labelKey,
    models: visibleModels.filter((m) => m.type === type),
  }))

  useEffect(() => {
    if (!testModelId) return
    if (testableModels.some((model) => model.id === testModelId)) return
    setTestModelId('')
  }, [testableModels, testModelId])

  function updateCfg(patch: Partial<ProviderRuntimeConfig>) {
    const next = { ...cfg, ...patch }
    if ('baseUrlText' in patch || 'baseUrlImage' in patch || 'baseUrlVideo' in patch) {
      next.baseUrl = next.baseUrlText
    }
    onChange({
      ...config,
      providers: { ...config.providers, [provider.id]: next },
    })
  }

  function toggleModel(modelId: string) {
    const key = `${provider.id}:${modelId}`
    const prev = config.enabledModels ?? {}
    if (prev[key]) {
      const next = { ...prev }
      delete next[key]
      onChange({ ...config, enabledModels: next })
    } else {
      onChange({ ...config, enabledModels: { ...prev, [key]: true } })
    }
  }

  function handleAddModel() {
    if (!newModel.id.trim()) return
    const modelId = newModel.id.trim()
    const providerDef = getProviderById(provider.id, config.customProviders)
    const isBuiltin = !!providerDef?.models.some((m) => m.id === modelId)
    const key = `${provider.id}:${modelId}`
    const hidden = config.hiddenModels ?? {}
    const nextHidden = { ...hidden }
    delete nextHidden[key]
    const model: ModelDef = {
      id: modelId,
      name: newModel.name.trim() || modelId,
      type: newModel.type,
      ...(newModel.type === 'embedding' && newModel.dimension ? { dimension: newModel.dimension } : {}),
    }
    const prev = config.customModels[provider.id] ?? []
    onChange({
      ...config,
      hiddenModels: nextHidden,
      customModels: {
        ...config.customModels,
        // 内置模型重新添加只恢复显示（解除隐藏），避免与内置同名重复
        [provider.id]: isBuiltin ? prev : [...prev, model],
      },
    })
    setNewModel({ id: '', name: '', type: 'text' })
    setAddingModel(false)
  }

  async function handleTestConnection() {
    if (!hasEnabledTestModels) {
      setTestState('error')
      setTestError(t('settings.aiTestNoTextModel'))
      return
    }
    const modelId = testModelId || testableModels[0]?.id
    if (!modelId) {
      setTestState('error')
      setTestError(t('settings.aiTestNoTextModel'))
      return
    }
    setTestState('testing')
    setTestError('')
    const result = await window.aiAPI.testConnection({
      providerId: provider.id,
      modelId,
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrlText || provider.defaultBaseUrl || undefined,
    })
    if (result.ok) {
      setTestState('ok')
    } else {
      setTestState('error')
      setTestError(result.error ?? '')
    }
  }

  function removeModel(model: ModelDef) {
    const key = `${provider.id}:${model.id}`
    const isCustom = customModels.some((m) => m.id === model.id)
    if (isCustom) {
      const prev = config.customModels[provider.id] ?? []
      onChange({
        ...config,
        customModels: { ...config.customModels, [provider.id]: prev.filter((m) => m.id !== model.id) },
      })
    } else {
      onChange({
        ...config,
        hiddenModels: { ...(config.hiddenModels ?? {}), [key]: true },
      })
    }
  }

  function startEditModel(model: ModelDef) {
    setEditingModelId(model.id)
    setEditModel({ id: model.id, name: model.name, type: model.type, dimension: model.dimension })
  }

  function handleSaveEdit() {
    if (!editModel.id.trim() || !editingModelId) return
    const isCustom = customModels.some((m) => m.id === editingModelId)
    const updated: ModelDef = {
      id: editModel.id.trim(),
      name: editModel.name.trim() || editModel.id.trim(),
      type: editModel.type,
      ...(editModel.type === 'embedding' && editModel.dimension ? { dimension: editModel.dimension } : {}),
    }
    if (isCustom) {
      const prev = config.customModels[provider.id] ?? []
      onChange({
        ...config,
        customModels: {
          ...config.customModels,
          [provider.id]: prev.map((m) => m.id === editingModelId ? updated : m),
        },
      })
    } else {
      // Hide the original built-in, add edited version as custom
      const originalKey = `${provider.id}:${editingModelId}`
      const prev = config.customModels[provider.id] ?? []
      onChange({
        ...config,
        customModels: { ...config.customModels, [provider.id]: [...prev, updated] },
        hiddenModels: { ...(config.hiddenModels ?? {}), [originalKey]: true },
      })
    }
    setEditingModelId(null)
  }

  function renderModelRow(model: ModelDef) {
    const key = `${provider.id}:${model.id}`
    const isEnabled = !!config.enabledModels?.[key]
    const isEditing = editingModelId === model.id

    if (isEditing) {
      return (
        <div key={model.id} className="flex gap-1.5 items-center p-2 bg-base-200 rounded-lg flex-wrap">
          <input
            className="input input-bordered input-xs flex-1 min-w-32 font-mono"
            placeholder="Model ID"
            value={editModel.id}
            onChange={(e) => setEditModel((p) => ({ ...p, id: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingModelId(null) }}
            autoFocus
          />
          <input
            className="input input-bordered input-xs w-28"
            placeholder={t('settings.aiModelName')}
            value={editModel.name}
            onChange={(e) => setEditModel((p) => ({ ...p, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingModelId(null) }}
          />
          <select
            className="select select-bordered select-xs"
            value={editModel.type}
            onChange={(e) => setEditModel((p) => ({ ...p, type: e.target.value as ModelType, dimension: undefined }))}
          >
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
          <button className="btn btn-primary btn-xs btn-square" onClick={handleSaveEdit}>
            <Check size={12} />
          </button>
          <button className="btn btn-ghost btn-xs btn-square" onClick={() => setEditingModelId(null)}>
            <X size={12} />
          </button>
        </div>
      )
    }

    return (
      <div
        key={model.id}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-base-200 group"
      >
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-xs shrink-0"
          checked={isEnabled}
          onChange={() => toggleModel(model.id)}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="flex-1 text-sm truncate">{model.name}</span>
        <code className="text-[10px] text-base-content/40 font-mono hidden md:block truncate max-w-36">
          {model.id}
        </code>
        {model.type === 'embedding' && model.dimension && (
          <span className="text-[10px] text-base-content/40 font-mono shrink-0">
            {model.dimension}d
          </span>
        )}
        <span className={`badge badge-xs ${typeBadgeClass(model.type)}`}>
          {model.type}
        </span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={() => startEditModel(model)}
          >
            <PencilLine size={11} />
          </button>
          <button
            className="btn btn-ghost btn-xs btn-square text-error"
            onClick={() => removeModel(model)}
          >
            <X size={11} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Provider header */}
      <div className="px-6 py-4 border-b border-base-300 flex items-center gap-3 shrink-0">
        <ProviderAvatar id={provider.id} name={provider.name} size={28} />
        <span className="font-semibold text-sm">{provider.name}</span>
        <span className={`badge ${cfg.enabled ? 'badge-success' : 'badge-ghost'}`}>
          {cfg.enabled ? t('settings.aiEnabled') : t('settings.aiDisabled')}
        </span>
        {isCustomProvider && onRemoveProvider && (
          <button
            className="btn btn-ghost btn-xs btn-square ml-auto text-error"
            title={t('settings.aiRemoveProvider')}
            onClick={onRemoveProvider}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto px-6 py-5 flex flex-col gap-5">

        {/* API Key — hidden for providers that don't require one */}
        {!provider.noApiKey && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-base-content/60 uppercase tracking-wide">
              {t('settings.aiApiKey')}
            </label>
            <div className="flex gap-1.5">
              <input
                type={showKey ? 'text' : 'password'}
                className="input input-bordered flex-1 font-mono"
                placeholder="sk-..."
                value={cfg.apiKey}
                onChange={(e) => { updateCfg({ apiKey: e.target.value }); setTestState('idle') }}
              />
              <button
                className="btn btn-ghost btn-square shrink-0"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        )}

        {/* Base URLs */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-base-content/60 uppercase tracking-wide">
            {t('settings.aiBaseUrl')}
          </label>
          <div className="flex flex-col gap-2">
            <label className="form-control">
              <span className="label-text text-[11px] text-base-content/60">{t('settings.aiBaseUrlText')}</span>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder={getBaseUrlPlaceholder(provider, 'text', t('settings.aiBaseUrlPlaceholder'))}
                value={cfg.baseUrlText}
                onChange={(e) => {
                  updateCfg({ baseUrlText: e.target.value })
                  setTestState('idle')
                }}
              />
            </label>
            <label className="form-control">
              <span className="label-text text-[11px] text-base-content/60">{t('settings.aiBaseUrlImage')}</span>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder={getBaseUrlPlaceholder(provider, 'image', t('settings.aiBaseUrlPlaceholder'))}
                value={cfg.baseUrlImage}
                onChange={(e) => {
                  updateCfg({ baseUrlImage: e.target.value })
                }}
              />
            </label>
            <label className="form-control">
              <span className="label-text text-[11px] text-base-content/60">{t('settings.aiBaseUrlVideo')}</span>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder={getBaseUrlPlaceholder(provider, 'video', t('settings.aiBaseUrlPlaceholder'))}
                value={cfg.baseUrlVideo}
                onChange={(e) => {
                  updateCfg({ baseUrlVideo: e.target.value })
                }}
              />
            </label>
          </div>
        </div>

        {/* Test Connection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-base-content/60 uppercase tracking-wide">
            {t('settings.aiTestConnection')}
          </label>
          <div className="flex gap-1.5">
            <select
              className="select select-bordered flex-1"
              value={testModelId}
              onChange={(e) => { setTestModelId(e.target.value); setTestState('idle') }}
            >
              <option value="">{hasEnabledTestModels ? t('settings.aiTestAutoModel') : t('settings.aiTestNoTextModel')}</option>
              {testableModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <button
              className="btn btn-outline shrink-0"
              disabled={testState === 'testing' || !hasEnabledTestModels || (!cfg.apiKey && !cfg.baseUrlText && !provider.defaultBaseUrl)}
              onClick={handleTestConnection}
            >
              {testState === 'testing' ? (
                <Loader size={14} className="animate-spin" />
              ) : testState === 'ok' ? (
                <CheckCircle size={14} className="text-success" />
              ) : testState === 'error' ? (
                <XCircle size={14} className="text-error" />
              ) : null}
              {t('settings.aiTestConnection')}
            </button>
          </div>
          {testState === 'error' && testError && (
            <p className="text-xs text-error mt-1">{testError}</p>
          )}
          {testState === 'ok' && (
            <p className="text-xs text-success mt-1">{t('settings.aiTestSuccess')}</p>
          )}
        </div>

        {/* Available Models */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-base-content/60 uppercase tracking-wide">
              {t('settings.aiAvailableModels')}
            </label>
            <button
              className="btn btn-ghost btn-xs gap-1"
              onClick={() => {
                setAddingModel(true)
                setNewModel({ id: '', name: '', type: 'text' })
              }}
            >
              <Plus size={11} />
              {t('settings.aiAddModel')}
            </button>
          </div>

          {/* Add model inline form */}
          {addingModel && (
            <div className="flex gap-1.5 items-center p-2 bg-base-200 rounded-lg flex-wrap">
              <input
                className="input input-bordered input-xs flex-1 min-w-32 font-mono"
                placeholder="Model ID"
                value={newModel.id}
                onChange={(e) => setNewModel((p) => ({ ...p, id: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                autoFocus
              />
              <input
                className="input input-bordered input-xs w-28"
                placeholder={t('settings.aiModelName')}
                value={newModel.name}
                onChange={(e) => setNewModel((p) => ({ ...p, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
              />
              <select
                className="select select-bordered select-xs"
                value={newModel.type}
                onChange={(e) => setNewModel((p) => ({ ...p, type: e.target.value as ModelType, dimension: undefined }))}
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
              <button className="btn btn-primary btn-xs btn-square" onClick={handleAddModel}>
                <Plus size={12} />
              </button>
              <button className="btn btn-ghost btn-xs btn-square" onClick={() => setAddingModel(false)}>
                <X size={12} />
              </button>
            </div>
          )}

          {/* Model list */}
          <div className="flex flex-col">
            {modelsByType.map((section) => (
              <div key={section.type} className="flex flex-col gap-1.5">
                <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-base-content/45">
                  {t(section.labelKey)}
                </div>
                {section.models.length === 0
                  ? <div className="px-2 py-1 text-xs text-base-content/35">-</div>
                  : section.models.map((model) => renderModelRow(model))}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
