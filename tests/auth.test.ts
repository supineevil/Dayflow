import { describe, expect, it } from 'vitest';
import { parseAuthRedirect } from '../src/core/google/auth';
import { GOOGLE_SCOPES } from '../src/core/google/config';

const ok = (extra = '') =>
  `https://abc.chromiumapp.org/#access_token=tok&token_type=Bearer&expires_in=3599&state=S&scope=${encodeURIComponent(GOOGLE_SCOPES.join(' '))}${extra}`;

describe('parseAuthRedirect', () => {
  it('extracts the token and expiry', () => {
    const t = parseAuthRedirect(ok(), 'S');
    expect(t.accessToken).toBe('tok');
    expect(t.expiresAt).toBeGreaterThan(Date.now() + 3_000_000);
  });
  it('rejects a mismatched state', () => {
    expect(() => parseAuthRedirect(ok(), 'OTHER')).toThrowError(/did not match/);
  });
  it('maps silent-renewal failures to "expired"', () => {
    expect(() => parseAuthRedirect('https://abc.chromiumapp.org/#error=interaction_required&state=S', 'S')).toThrowError(expect.objectContaining({ code: 'expired' }));
    expect(() => parseAuthRedirect('https://abc.chromiumapp.org/#error=login_required', 'S')).toThrowError(expect.objectContaining({ code: 'expired' }));
  });
  it('maps denial to "cancelled"', () => {
    expect(() => parseAuthRedirect('https://abc.chromiumapp.org/#error=access_denied', 'S')).toThrowError(expect.objectContaining({ code: 'cancelled' }));
  });
  it('rejects a grant that is missing a required scope', () => {
    const partial = `https://abc.chromiumapp.org/#access_token=t&expires_in=3599&state=S&scope=${encodeURIComponent(GOOGLE_SCOPES[0])}`;
    expect(() => parseAuthRedirect(partial, 'S')).toThrowError(/not fully granted/);
  });
});
