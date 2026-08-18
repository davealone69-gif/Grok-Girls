/**
 * Safe environment-key template.
 *
 * Copy this file to keys.ts in your local/dev environment or configure the
 * values through the platform's environment settings. Never commit real
 * Supabase service keys, Stripe secrets, or other credentials.
 */

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

// Stripe Payment Links are public checkout URLs, but keeping them configurable
// avoids hard-coding deployment-specific links into application code.
export const STRIPE_PAYMENT_LINK = '';

export const STRIPE_PAYMENT_LINK_2 = '';

export default {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  STRIPE_PAYMENT_LINK,
  STRIPE_PAYMENT_LINK_2,
};
