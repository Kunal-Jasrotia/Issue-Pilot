'use client';
import { useEffect, useState } from 'react';
import { api, type User } from '@/lib/api';
import { ShieldCheck, Check, Loader2, Eye, EyeOff, Sparkles } from 'lucide-react';

const PROVIDERS = [
  {
    id: 'openai' as const,
    label: 'OpenAI',
    description: 'GPT-4o, GPT-4 Turbo',
    emoji: '🟢',
    inactiveClasses: 'border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/60',
    activeClasses: 'border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/20',
    dotColor: 'bg-emerald-400',
    labelActive: 'text-emerald-300',
  },
  {
    id: 'claude' as const,
    label: 'Claude',
    description: 'Opus, Sonnet, Haiku',
    emoji: '🟣',
    inactiveClasses: 'border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/60',
    activeClasses: 'border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/20',
    dotColor: 'bg-violet-400',
    labelActive: 'text-violet-300',
  },
  {
    id: 'ollama' as const,
    label: 'Ollama',
    description: 'Local models',
    emoji: '🟠',
    inactiveClasses: 'border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/60',
    activeClasses: 'border-orange-500/60 bg-orange-500/10 ring-1 ring-orange-500/20',
    dotColor: 'bg-orange-400',
    labelActive: 'text-orange-300',
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

  return (
    <div className="h-full overflow-auto p-8 max-w-2xl space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Configure your AI provider and credentials</p>
      </div>

      {/* AI Provider card */}
      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
        {/* Card header */}
        <div className="flex items-center gap-2.5 border-b border-gray-800 px-5 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600/15">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-100">AI Provider</h2>
            <p className="text-xs text-gray-500">Choose which model powers the agent pipeline</p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Provider selector */}
          <div className="grid grid-cols-3 gap-2.5">
            {PROVIDERS.map((p) => {
              const isActive = provider === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => { setProvider(p.id); setApiKey(''); }}
                  className={`relative flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-all ${
                    isActive ? p.activeClasses : p.inactiveClasses
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${p.dotColor}`} />
                    <span className={`text-sm font-semibold ${isActive ? p.labelActive : 'text-gray-400'}`}>
                      {p.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{p.description}</span>
                  {isActive && (
                    <div className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-white/10">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* API Key */}
          {provider !== 'ollama' && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-400">
                API Key
                {user?.llmProvider === provider && (
                  <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-600 ring-1 ring-gray-700">
                    leave blank to keep existing
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/80 px-3.5 py-2.5 pr-10 text-sm text-white placeholder-gray-600 transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                className="w-full rounded-lg border border-gray-700 bg-gray-800/80 px-3.5 py-2.5 text-sm text-white transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          )}

          {/* Model select */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800/80 px-3.5 py-2.5 text-sm text-white transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">Default</option>
              {DEFAULT_MODELS[provider]?.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800" />

          {/* Save */}
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] ${
              saved
                ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                : 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 shadow-lg shadow-brand-600/20'
            }`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saved && <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : saved ? 'Settings saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-800">
          <ShieldCheck className="h-3.5 w-3.5 text-gray-500" />
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          API keys are encrypted at rest using <span className="text-gray-400 font-medium">AES-256-GCM</span> before storage.
          Keys are never logged or exposed in the UI after saving.
        </p>
      </div>
    </div>
  );
}
