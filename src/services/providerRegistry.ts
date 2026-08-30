import { ProviderName, Mode, getSavedApiKey, getSavedEndpoint, getSavedModel } from './providers';

export interface ProviderDescriptor {
  id: ProviderName;
  label: string;
  modes: Mode[];
  requiresKey: boolean;
  defaultEndpoint?: string;
}

export const PROVIDERS: ProviderDescriptor[] = [
  { id: 'openrouter', label: 'OpenRouter', modes: ['image', 'video'], requiresKey: true, defaultEndpoint: 'https://openrouter.ai/api/v1/chat/completions' },
  { id: 'gemini', label: 'Gemini', modes: ['image', 'video'], requiresKey: true, defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'selfhosted', label: 'Self-hosted', modes: ['image', 'video'], requiresKey: false },
  { id: 'custom', label: 'Custom OpenAI-compatible', modes: ['image', 'video'], requiresKey: true },
  { id: 'local', label: 'Local fallback', modes: ['image', 'video'], requiresKey: false },
];

export function providerStatus(id: ProviderName, mode: Mode) {
  const p = PROVIDERS.find(x => x.id === id)!;
  return {
    configured: !p.requiresKey || Boolean(getSavedApiKey(id)) || Boolean(getSavedEndpoint(id, mode)),
    model: getSavedModel(id, mode),
    endpoint: getSavedEndpoint(id, mode),
  };
}

export function providerOptions(mode: Mode) {
  return PROVIDERS.filter(p => p.modes.includes(mode));
}
