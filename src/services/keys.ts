/**
 * Runtime configuration defaults.
 *
 * This file intentionally contains no real credentials. Production/preview
 * deployments should inject these values through the environment/configuration
 * system. The services are defensive and will remain usable without them.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
export const STRIPE_PAYMENT_LINK = '';
export const STRIPE_PAYMENT_LINK_2 = '';

export default {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  STRIPE_PAYMENT_LINK,
  STRIPE_PAYMENT_LINK_2,
};
