import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { useSessionStore } from '@web/entities/session';
import { ChangePasswordForm } from '@web/features/auth/change-password';
import { changePasswordSchema } from '@web/features/auth/change-password/model/schema';
import { authApi } from '@web/shared/api/auth-api';
import { ApiError } from '@web/shared/api/http-client';

jest.mock('@web/shared/api/auth-api', () => ({
  authApi: { changePassword: jest.fn() },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const changePassword = authApi.changePassword as jest.MockedFunction<
  typeof authApi.changePassword
>;

const VALID = {
  currentPassword: 'old-password',
  newPassword: 'new-password',
  confirmPassword: 'new-password',
};

describe('changePasswordSchema', () => {
  it('accepts a valid change', () => {
    expect(changePasswordSchema.safeParse(VALID).success).toBe(true);
  });

  it.each([
    ['no current password', { currentPassword: '' }, 'currentPassword'],
    ['a short new password', { newPassword: 'short', confirmPassword: 'short' }, 'newPassword'],
    ['a new password over 72 characters', { newPassword: 'x'.repeat(73), confirmPassword: 'x'.repeat(73) }, 'newPassword'],
    ['a mismatched repeat', { confirmPassword: 'new-passwor' }, 'confirmPassword'],
    ['the same password again', { newPassword: 'old-password', confirmPassword: 'old-password' }, 'newPassword'],
  ])('rejects %s', (_label, override, field) => {
    const result = changePasswordSchema.safeParse({ ...VALID, ...override });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toContain(field);
  });
});

describe('ChangePasswordForm', () => {
  async function fillAndSubmit(values = VALID) {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);
    await user.type(screen.getByLabelText('Current password'), values.currentPassword);
    await user.type(screen.getByLabelText('New password'), values.newPassword);
    await user.type(
      screen.getByLabelText('Repeat the new password'),
      values.confirmPassword
    );
    await user.click(screen.getByRole('button', { name: 'Change password' }));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({
      user: { id: 'user-1', email: 'jane@example.com', name: 'Jane' },
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
    } as never);
  });

  it('changes the password and keeps the session with the new tokens', async () => {
    changePassword.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    await fillAndSubmit();

    await waitFor(() =>
      expect(useSessionStore.getState().refreshToken).toBe('new-refresh')
    );
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });
    expect(useSessionStore.getState().accessToken).toBe('new-access');
    expect(toast.success).toHaveBeenCalled();
    // The form is emptied for the next time.
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('marks the current password when the server rejects it', async () => {
    changePassword.mockRejectedValue(
      new ApiError(400, ['Current password is incorrect'], 'Bad Request')
    );

    await fillAndSubmit();

    expect(
      await screen.findByText('Current password is incorrect')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(useSessionStore.getState().refreshToken).toBe('old-refresh');
  });

  it('reports other failures in a toast', async () => {
    changePassword.mockRejectedValue(new Error('Network down'));

    await fillAndSubmit();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Network down'));
  });

  it('does not send a form that fails validation', async () => {
    await fillAndSubmit({ ...VALID, confirmPassword: 'different' });

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });
});
