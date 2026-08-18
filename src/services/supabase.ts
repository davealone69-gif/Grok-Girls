import { createClient } from '@supabase/supabase-js';
import * as keys from './keys';

declare const localStorage: any;
declare const AsyncStorage: any;

function getAuthStorage() {
  if (typeof localStorage !== 'undefined' && localStorage) return localStorage;

  if (typeof AsyncStorage !== 'undefined' && AsyncStorage) {
    return {
      getItem: (key: string) => AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: (key: string) => AsyncStorage.removeItem(key),
    };
  }

  try {
    const NativeAsyncStorage = require('@react-native-async-storage/async-storage').default;
    if (NativeAsyncStorage) {
      return {
        getItem: (key: string) => NativeAsyncStorage.getItem(key),
        setItem: (key: string, value: string) => NativeAsyncStorage.setItem(key, value),
        removeItem: (key: string) => NativeAsyncStorage.removeItem(key),
      };
    }
  } catch {
    // Fall through to in-memory session behavior.
  }

  return undefined;
}

const rawSupabaseUrl = String((keys as any).SUPABASE_URL || '').trim();
const supabaseUrlIsValid = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(rawSupabaseUrl);

if (rawSupabaseUrl && !supabaseUrlIsValid) {
  console.error(
    '[Supabase] Invalid SUPABASE_URL. Expected https://your-project.supabase.co'
  );
}

const supabaseUrl = supabaseUrlIsValid ? rawSupabaseUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = (keys as any).SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getAuthStorage() as any,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
