export function getAuthRedirectUrl(target: 'auth' | 'reset-password' = 'auth'): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const route = target === 'auth' ? '/auth' : '/auth/reset-password';
  return `${window.location.origin}${route}${window.location.search}`;
}

export async function openCheckoutUrl(url: string): Promise<void> {
  window.location.href = url;
}
