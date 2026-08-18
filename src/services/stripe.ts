import * as keys from './keys';

declare const window: any;
declare const Linking: any;

function collectStripeLinks(): Record<string, string> {
  const found: Record<string, string> = {};
  const all = keys as any;
  for (const name of Object.keys(all)) {
    const value = all[name];
    if (
      typeof value === 'string' &&
      /^https?:\/\//.test(value) &&
      (/stripe\.com/.test(value) || /^STRIPE/i.test(name))
    ) {
      found[name] = value;
    }
  }
  return found;
}

export const stripePaymentLinks: Record<string, string> = collectStripeLinks();
export const stripePaymentLink: string =
  stripePaymentLinks.STRIPE_PAYMENT_LINK || Object.values(stripePaymentLinks)[0] || '';

export interface PaymentLinkOptions {
  paymentLink?: string;
  key?: string;
  userId?: string;
  email?: string;
}

export function redirectToPaymentLink(opts: PaymentLinkOptions = {}): boolean {
  const base =
    opts.paymentLink ||
    (opts.key ? stripePaymentLinks[opts.key] : '') ||
    stripePaymentLink;

  if (!base) {
    console.warn('[stripe] No Stripe payment link configured.');
    return false;
  }

  let target = base;
  try {
    const url = new URL(base);
    if (opts.userId) url.searchParams.set('client_reference_id', opts.userId);
    if (opts.email) url.searchParams.set('prefilled_email', opts.email);
    target = url.toString();
  } catch {
    // Open the original link when URL parsing is unavailable.
  }

  if (typeof window !== 'undefined' && window && window.location) {
    let framed = false;
    try {
      framed = window.self !== window.top;
    } catch {
      framed = true;
    }
    if (framed && window.open) window.open(target, '_blank');
    else window.location.href = target;
    return true;
  }

  if (typeof Linking !== 'undefined' && Linking?.openURL) {
    Linking.openURL(target);
    return true;
  }

  console.warn('[stripe] Could not open the payment page on this platform.');
  return false;
}
