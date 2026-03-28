import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const MOBILE_DEEP_LINK_BASE = import.meta.env.VITE_MOBILE_DEEP_LINK_BASE || 'chaseai://auth';

export function isNativeMobileApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getMobileDeepLinkBase(): string {
  return MOBILE_DEEP_LINK_BASE.replace(/\/+$/, '');
}

export function getAuthRedirectUrl(target: 'auth' | 'reset-password' = 'auth'): string | undefined {
  if (typeof window === 'undefined') return undefined;

  if (isNativeMobileApp()) {
    const base = getMobileDeepLinkBase();
    return target === 'auth' ? base : `${base}/reset-password`;
  }

  const route = target === 'auth' ? '/auth' : '/auth/reset-password';
  return `${window.location.origin}${route}${window.location.search}`;
}

export async function openCheckoutUrl(url: string): Promise<void> {
  if (isNativeMobileApp()) {
    await Browser.open({
      url,
      presentationStyle: 'fullscreen',
    });
    return;
  }

  window.location.href = url;
}
