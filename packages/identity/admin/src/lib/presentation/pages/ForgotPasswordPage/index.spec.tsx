import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@orthacms/utils-admin';
import { httpAuthGateway } from '../../../infrastructure/httpAuthGateway';
import { ForgotPasswordPage } from './index';

vi.mock('../../../infrastructure/httpAuthGateway', () => ({
    httpAuthGateway: {
        passwordRecoveryAvailable: vi.fn(),
        requestPasswordRecovery: vi.fn()
    }
}));

const gateway = vi.mocked(httpAuthGateway);

function renderPage() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <IntlProvider locale="en" onError={() => undefined}>
                <MemoryRouter>
                    <ForgotPasswordPage />
                </MemoryRouter>
            </IntlProvider>
        </QueryClientProvider>
    );
}

describe('ForgotPasswordPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('says who can help, naming nobody, when the server sends no mail', async () => {
        gateway.passwordRecoveryAvailable.mockResolvedValue(false);
        const { container } = renderPage();

        expect(
            await screen.findByText(/This server doesn’t send reset emails/)
        ).toBeTruthy();
        expect(
            screen.getByText(/Members → your name → Sessions & access/)
        ).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Back to sign in' })
                .getAttribute('href')
        ).toBe('/identity/signin');
        expect(container.querySelector('form')).toBeNull();
    });

    it('falls back to the same card when it cannot tell', async () => {
        gateway.passwordRecoveryAvailable.mockRejectedValue(new ApiError(null));
        renderPage();

        // The hook retries once before giving up, hence the longer wait.
        expect(
            await screen.findByText(
                /This server doesn’t send reset emails/,
                undefined,
                { timeout: 5000 }
            )
        ).toBeTruthy();
    });

    it('confirms every request the same way, echoing the address without vouching for it', async () => {
        gateway.passwordRecoveryAvailable.mockResolvedValue(true);
        gateway.requestPasswordRecovery.mockResolvedValue(undefined);
        renderPage();

        fireEvent.change(await screen.findByLabelText('Email'), {
            target: { value: 'nobody@example.com' }
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Send reset link' })
        );

        expect(
            await screen.findByRole('heading', { name: 'Check your email' })
        ).toBeTruthy();
        expect(
            screen.getByText(/belongs to an account here/).textContent
        ).toContain('If nobody@example.com belongs to an account here');
        expect(gateway.requestPasswordRecovery).toHaveBeenCalledWith(
            'nobody@example.com'
        );
    });

    it('keeps the throttle message generic', async () => {
        gateway.passwordRecoveryAvailable.mockResolvedValue(true);
        gateway.requestPasswordRecovery.mockRejectedValue(new ApiError(429));
        renderPage();

        fireEvent.change(await screen.findByLabelText('Email'), {
            target: { value: 'ada@example.com' }
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Send reset link' })
        );

        await waitFor(() =>
            expect(screen.getByRole('alert').textContent).toContain(
                'Too many attempts from this device'
            )
        );
    });
});
