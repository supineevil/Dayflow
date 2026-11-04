import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from './config';

/**
 * Sign-in via chrome.identity.launchWebAuthFlow with Google's OAuth 2.0 implicit flow.
 * Google shows its own account chooser, so any Google account works, in any Chromium browser.
 *
 * Tokens last about an hour and are kept only in chrome.storage.session (memory, cleared when the
 * browser closes). There is no refresh token: when a token expires we ask Google for a new one
 * silently (prompt=none). If Google needs the user, we report 'expired' and the UI offers "Reconnect".
 */

export type AuthErrorCode = 'not_configured' | 'unavailable' | 'expired' | 'cancelled' | 'failed';

export class AuthError extends Error {
  constructor(public code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

interface StoredToken {
  accessToken: string;
  /** epoch ms */
  expiresAt: number;
}

const TOKEN_KEY = 'dayflow:token';
const EXPIRY_MARGIN_MS = 60_000;
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

const hasIdentity = () => typeof chrome !== 'undefined' && !!chrome.identity?.launchWebAuthFlow && !!chrome.storage?.session;

async function readToken(): Promise<StoredToken | undefined> {
  const stored = await chrome.storage.session.get(TOKEN_KEY);
  return stored[TOKEN_KEY] as StoredToken | undefined;
}

export function buildAuthUrl(opts: { redirectUri: string; state: string; prompt: string; loginHint?: string }): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  url.searchParams.set('state', opts.state);
  url.searchParams.set('prompt', opts.prompt);
  if (opts.loginHint) url.searchParams.set('login_hint', opts.loginHint);
  return url.toString();
}

/** Parses the redirect URL Google sends back (parameters arrive in the #fragment). */
export function parseAuthRedirect(redirect: string, expectedState: string): StoredToken {
  const params = new URLSearchParams(new URL(redirect).hash.replace(/^#/, ''));
  const error = params.get('error');
  if (error) {
    const interaction = ['interaction_required', 'login_required', 'consent_required', 'account_selection_required'];
    if (interaction.includes(error)) throw new AuthError('expired', 'Google needs you to sign in again.');
    if (error === 'access_denied') throw new AuthError('cancelled', 'Sign-in was cancelled or access was denied.');
    throw new AuthError('failed', `Google sign-in failed (${error}).`);
  }
  if (params.get('state') !== expectedState) throw new AuthError('failed', 'Sign-in response did not match the request.');

  const accessToken = params.get('access_token');
  const expiresIn = Number(params.get('expires_in'));
  if (!accessToken || !Number.isFinite(expiresIn)) throw new AuthError('failed', 'Google did not return an access token.');

  // Users can untick individual permissions on the consent screen. Dayflow needs both.
  const granted = (params.get('scope') ?? '').split(' ');
  if (!GOOGLE_SCOPES.every((s) => granted.includes(s))) {
    throw new AuthError('failed', 'Calendar access was not fully granted. Reconnect and keep both calendar permissions ticked.');
  }
  return { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
}

async function runFlow(opts: { interactive: boolean; prompt: string; loginHint?: string }): Promise<StoredToken> {
  if (!GOOGLE_CLIENT_ID) {
    throw new AuthError('not_configured', 'No Google client ID is set. See docs/GOOGLE_SETUP.md.');
  }
  if (!hasIdentity()) throw new AuthError('unavailable', 'Google sign-in only works inside the installed extension.');

  const state = crypto.randomUUID();
  const url = buildAuthUrl({ redirectUri: chrome.identity.getRedirectURL(), state, prompt: opts.prompt, loginHint: opts.loginHint });

  let redirect: string | undefined;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({ url, interactive: opts.interactive });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!opts.interactive) throw new AuthError('expired', 'Google needs you to sign in again.');
    if (/did not approve|closed|cancel/i.test(message)) throw new AuthError('cancelled', 'Sign-in was cancelled.');
    throw new AuthError('failed', `Could not complete sign-in: ${message}`);
  }
  if (!redirect) throw new AuthError(opts.interactive ? 'cancelled' : 'expired', 'No response from Google.');

  const token = parseAuthRedirect(redirect, state);
  await chrome.storage.session.set({ [TOKEN_KEY]: token });
  return token;
}

/** Opens Google's account chooser. Must be called from a visible page (side panel or options), not the popup. */
export async function signIn(): Promise<void> {
  await runFlow({ interactive: true, prompt: 'select_account' });
}

let renewal: Promise<StoredToken> | null = null;

/** Returns a valid access token, renewing silently if needed. Throws AuthError('expired') if the user must sign in again. */
export async function getAccessToken(loginHint?: string): Promise<string> {
  if (!hasIdentity()) throw new AuthError('unavailable', 'Google sign-in only works inside the installed extension.');
  const current = await readToken();
  if (current && current.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return current.accessToken;

  // Several callers may notice the expiry at once; share one renewal.
  renewal ??= runFlow({ interactive: false, prompt: 'none', loginHint }).finally(() => {
    renewal = null;
  });
  return (await renewal).accessToken;
}

/** Forget the cached token (e.g. after a 401) so the next call renews it. */
export async function discardToken(): Promise<void> {
  if (hasIdentity()) await chrome.storage.session.remove(TOKEN_KEY);
}

/** Revokes Dayflow's access at Google and forgets the token. Revocation is best-effort. */
export async function signOut(): Promise<void> {
  if (!hasIdentity()) return;
  const token = await readToken();
  await discardToken();
  if (!token) return;
  try {
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: token.accessToken }),
    });
  } catch {
    // Offline: the token still expires on its own within the hour.
  }
}
