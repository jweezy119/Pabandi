import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SmsProviderSettings } from './SmsProviderSettings';
import { smsSettingsService } from '../services/api';

/**
 * The UI must never claim a state the server did not confirm.
 *
 * The previous attempt at this screen posted to an endpoint that stored nothing and
 * replied "Credentials saved". So these tests are mostly about NOT lying:
 *
 *   - "connected" only when the server says VERIFIED;
 *   - a FAILED connection shows the provider's own reason, not a generic apology;
 *   - the credential inputs are never pre-filled (the server cannot read them back);
 *   - a 503 says the key was NOT saved, rather than looking like a transient failure;
 *   - a failed action leaves a working control, not a disabled one.
 */

vi.mock('../services/api', () => ({
  smsSettingsService: {
    get: vi.fn(),
    connect: vi.fn(),
    verify: vi.fn(),
    disconnect: vi.fn(),
  },
}));

const mockGet = vi.mocked(smsSettingsService.get);
const mockConnect = vi.mocked(smsSettingsService.connect);
const mockVerify = vi.mocked(smsSettingsService.verify);
const mockDisconnect = vi.mocked(smsSettingsService.disconnect);

const NOT_CONNECTED = { data: { success: true, data: { connected: false, provider: null } } };

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(NOT_CONNECTED as never);
  mockConnect.mockResolvedValue({
    data: { success: true, data: { connected: true, provider: { provider: 'TWILIO', fromNumber: '+15550100', status: 'VERIFIED', lastError: null, lastVerifiedAt: '2026-01-01T00:00:00Z' } } },
  } as never);
});

describe('not connected', () => {
  it('renders a connect form and no connection claim', async () => {
    render(<SmsProviderSettings />);
    await waitFor(() => expect(screen.getByLabelText(/account sid/i)).toBeTruthy());
    expect(screen.getByText(/connect provider/i)).toBeTruthy();
    expect(screen.queryByText(/re-verify/i)).toBeNull();
  });

  // The secret is write-only on the server, so a pre-filled field would be a lie.
  it('never pre-fills a credential field', async () => {
    mockGet.mockResolvedValue({
      data: { success: true, data: { connected: true, provider: { provider: 'TWILIO', fromNumber: '+15550100', status: 'VERIFIED', lastError: null, lastVerifiedAt: '2026-01-01T00:00:00Z' } } },
    } as never);

    render(<SmsProviderSettings />);
    await waitFor(() => expect(screen.getByText(/re-verify/i)).toBeTruthy());

    const sid = screen.getByLabelText(/account sid/i) as HTMLInputElement;
    const token = screen.getByLabelText(/auth token/i) as HTMLInputElement;
    expect(sid.value).toBe('');
    expect(token.value).toBe('');
    // And the auth token is a password field, so it is not shoulder-readable.
    expect(token.type).toBe('password');
  });

  it('reports a status endpoint failure instead of showing an empty form over a real connection', async () => {
    // "Could not load" and "not connected" are different states; conflating them hides a
    // working connection behind a blank form.
    mockGet.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }) as never);
    render(<SmsProviderSettings />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not load/i);
  });

  it('explains a 403 as unfinished business setup, not a network problem', async () => {
    mockGet.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 403 } }) as never);
    render(<SmsProviderSettings />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/finish setting up your business/i);
  });
});

describe('connecting', () => {
  it('sends the provider, from-number and credential', async () => {
    render(<SmsProviderSettings />);
    await waitFor(() => expect(screen.getByLabelText(/account sid/i)).toBeTruthy());

    screen.getByLabelText(/sending number/i).focus();
    const form = document.querySelector('form') as HTMLFormElement;
    // React state is driven by events, so drive the inputs directly.
    // React installs its own `value` setter on the element, so assigning `.value`
    // directly is invisible to it. Go through the prototype descriptor, and assert it
    // exists rather than letting it be possibly-undefined — a silent no-op here would
    // leave the input empty and the assertion below would fail for the wrong reason.
    const set = (el: Element, value: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
      const setter = descriptor?.set;
      if (!setter) throw new Error('could not find a value setter on the input');
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(screen.getByLabelText(/sending number/i), '+15550100');
    set(screen.getByLabelText(/account sid/i), 'AC123');
    set(screen.getByLabelText(/auth token/i), 'token123');
    expect(form).toBeTruthy();

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() =>
      expect(mockConnect).toHaveBeenCalledWith({
        provider: 'TWILIO',
        fromNumber: '+15550100',
        accountSid: 'AC123',
        authToken: 'token123',
      }),
    );
  });

  it('shows the connection only after the server confirms it', async () => {
    render(<SmsProviderSettings />);
    await waitFor(() => expect(screen.getByLabelText(/account sid/i)).toBeTruthy());
    expect(screen.queryByText(/re-verify/i)).toBeNull();

    mockConnect.mockResolvedValue({
      data: { success: true, data: { connected: true, provider: { provider: 'TWILIO', fromNumber: '+15550100', status: 'VERIFIED', lastError: null, lastVerifiedAt: '2026-01-01T00:00:00Z' } } },
    } as never);
    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => expect(screen.getByText(/re-verify/i)).toBeTruthy());
    expect(screen.getByText(/Verified/i)).toBeTruthy();
  });

  it("shows the provider's own reason when verification failed, and does NOT claim connected", async () => {
    mockConnect.mockResolvedValue({
      data: {
        success: true,
        data: {
          connected: false,
          provider: {
            provider: 'TWILIO',
            fromNumber: '+15550100',
            status: 'FAILED',
            lastError: 'Invalid username or password',
            lastVerifiedAt: null,
          },
        },
      },
    } as never);

    render(<SmsProviderSettings />);
    await waitFor(() => expect(screen.getByLabelText(/account sid/i)).toBeTruthy());
    (document.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    // The single most useful string we could show someone who pasted the wrong token.
    await waitFor(() => expect(screen.getAllByText(/invalid username or password/i).length).toBeGreaterThan(0));
    expect(screen.getByText(/not verified/i)).toBeTruthy();
    expect(screen.queryByText(/^Connected\./)).toBeNull();
  });

  // A 503 means nothing was written. Saying "try again" would imply it might have saved.
  it('says the credential was NOT saved when the server refuses to store it', async () => {
    mockConnect.mockRejectedValue(
      Object.assign(new Error('nope'), { response: { status: 503, data: { message: 'encryption is not configured' } } }) as never,
    );

    render(<SmsProviderSettings />);
    await waitFor(() => expect(screen.getByLabelText(/account sid/i)).toBeTruthy());
    (document.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/nothing was saved/i);
    // And the form is still usable — not a dead disabled button.
    expect(screen.getByText(/connect provider/i)).toBeTruthy();
  });
});

describe('an existing connection', () => {
  const connected = {
    data: { success: true, data: { connected: true, provider: { provider: 'VONAGE', fromNumber: '+447700900123', status: 'VERIFIED', lastError: null, lastVerifiedAt: '2026-01-01T00:00:00Z' } } },
  };

  it('shows provider, from-number and the replace affordance', async () => {
    mockGet.mockResolvedValue(connected as never);
    render(<SmsProviderSettings />);
    // Scoped to the connection line: /Vonage/ alone also matches the provider <option>,
    // so the first version of this test failed on "found multiple elements".
    await waitFor(() => expect(screen.getByText(/Vonage · \+447700900123/)).toBeTruthy());
    expect(screen.getByText(/^Verified/)).toBeTruthy();
    expect(screen.getByText(/replace provider/i)).toBeTruthy();
  });

  it('disconnecting requires confirmation, because it deletes the stored secret', async () => {
    mockGet.mockResolvedValue(connected as never);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SmsProviderSettings />);
    await waitFor(() => expect(screen.getByText(/disconnect/i)).toBeTruthy());

    screen.getByText(/disconnect/i).click();
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    // Declining must not delete anything.
    expect(mockDisconnect).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('reports a failed re-verify rather than silently keeping a stale "verified"', async () => {
    mockGet.mockResolvedValue(connected as never);
    mockVerify.mockResolvedValue({
      data: { success: true, data: { connected: false, provider: { provider: 'VONAGE', fromNumber: '+447700900123', status: 'FAILED', lastError: 'credentials revoked', lastVerifiedAt: null } } },
    } as never);

    render(<SmsProviderSettings />);
    await waitFor(() => expect(screen.getByText(/re-verify/i)).toBeTruthy());
    screen.getByText(/re-verify/i).click();

    await waitFor(() => expect(screen.getAllByText(/credentials revoked/i).length).toBeGreaterThan(0));
    expect(screen.getByText(/not verified/i)).toBeTruthy();
  });
});
