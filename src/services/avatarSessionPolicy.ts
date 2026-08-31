import { AvatarProviderConfig, validateAvatarProviderConfig } from './avatarProviders';

export interface AvatarSessionPolicy {
  maxIdleTimeoutSeconds: number;
  requireHttpsImages: boolean;
  allowProviderFallback: boolean;
  preferredProviders: string[];
}

export const DEFAULT_AVATAR_SESSION_POLICY: AvatarSessionPolicy = {
  maxIdleTimeoutSeconds: 900,
  requireHttpsImages: true,
  allowProviderFallback: false,
  preferredProviders: ['lemonslice', 'liveavatar', 'did']
};

export function enforceAvatarSessionPolicy(
  config: AvatarProviderConfig,
  policy: AvatarSessionPolicy = DEFAULT_AVATAR_SESSION_POLICY
): AvatarProviderConfig {
  validateAvatarProviderConfig(config);
  if (config.idleTimeout != null && config.idleTimeout > policy.maxIdleTimeoutSeconds) {
    throw new Error(`Idle timeout exceeds policy maximum of ${policy.maxIdleTimeoutSeconds}s`);
  }
  if (policy.requireHttpsImages && config.source.kind === 'imageUrl') {
    const url = new URL(config.source.imageUrl);
    if (url.protocol !== 'https:') throw new Error('HTTPS avatar images are required');
  }
  return { ...config };
}
