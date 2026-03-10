'use client';
import { useEffect, useState } from 'react';
import { api, type User } from '@/lib/api';
import { ShieldCheck, Check, Loader2, Eye, EyeOff } from 'lucide-react';

const PROVIDERS = [
  {
    id: 'openai' as const,
    label: 'OpenAI',
    description: 'GPT-4o, GPT-4 Turbo',
    color: 'bg-emerald-500/10 border-emerald-700/40',
    activeColor: 'border-emerald-500 bg-emerald-500/10',
    dot: 'bg-emerald-400',
  },
  {
    id: 'claude' as const,
    label: 'Claude',
    description: 'Opus, Sonnet, Haiku',
    color: 'bg-violet-500/10 border-violet-700/40',
    activeColor: 'border-violet-500 bg-violet-500/10',
    dot: 'bg-violet-400',
  },
  {
    id: 'ollama' as const,
    label: 'Ollama',
    description: 'Local models',
    color: 'bg-orange-500/10 border-orange-700/40',
    activeColor: 'border-orange-500 bg-orange-500/10',
    dot: 'bg-orange-400',
  },
] as const;

const DEFAULT_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  claude: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
  ollama: ['llama3.1', 'llama3.1:70b', 'mistral', 'deepseek-coder-v2', 'codestral'],
};

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.auth.me().then((u) => {
      setUser(u);
      setProvider(u.llmProvider ?? 'openai');
      setModel(u.llmModel ?? '');
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.auth.updateSettings({
        llmProvider: provider,
        llmApiKey: apiKey || undefined,
        llmModel: model || undefined,
        ollamaUrl: provider === 'ollama' ? ollamaUrl : undefined,
      });
      setSaved(true);
      setApiKey('');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(String(err));
    } finally {
      setSaving(false);
    }
  };

  const activeProvider = PROVIDERS.find((p) => p.id === provider);

  return (
    <div className="p-8 max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Configure your AI provider and credentials</p>
      </div>

      {/* AI Provider card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-200">AI Provider</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Choose which model powers the agent pipeline
          </p>
        </div>

        <div className="p-5 space-y-5">
          {/* Provider selector */}
          <div className="grid grid-cols-3 gap-2.5">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => { setProvider(p.id); setApiKey(''); }}
                className={`relative flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all ${
                  provider === p.id ? p.activeColor : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${p.dot}`} />
                  <span className={`text-sm font-semibold ${provider === p.id ? 'text-white' : 'text-gray-300'}`}>
                    {p.label}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{p.description}</span>
                {provider === p.id && (
                  <Check className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-current" />
                )}
              </button>
            ))}
          </div>

          {/* API Key */}
          {provider !== 'ollama' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">
                API Key
                {user?.llmProvider === provider && (
                  <span className="ml-1.5 text-gray-600">(leave blank to keep existing)</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 pr-10 text-sm text-white placeholder-gray-600 transition-colors focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Ollama URL */}
          {provider === 'ollama' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Ollama Base URL</label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white transition-colors focus:border-brand-500 focus:outline-none"
              />
            </div>
          )}

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white transition-colors focus:border-brand-500 focus:outline-none"
            >
              <option value="">Default</option>
              {DEFAULT_MODELS[provider]?.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Save */}
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              saved
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50'
            }`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saved && <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
        <p className="text-xs text-gray-500">
          API keys are encrypted at rest using AES-256-GCM before storage.
          Keys are never logged or exposed in the UI after saving.
        </p>
      </div>
    </div>
  );
}
