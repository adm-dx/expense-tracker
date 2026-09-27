import { COLOR_SCHEMES, DEFAULT_USER_SETTINGS } from '@expense-tracker/types';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { useSettingsStore } from '@web/entities/settings';
import { ThemeSettings } from '@web/features/settings/theme';
import { settingsApi } from '@web/shared/api/settings-api';
import type { ThemeSelection } from '@web/shared/lib/theme';

jest.mock('@web/shared/api/settings-api', () => ({
  settingsApi: { get: jest.fn(), update: jest.fn() },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const updateSettings = settingsApi.update as jest.MockedFunction<
  typeof settingsApi.update
>;

const SAVED: ThemeSelection = { theme: 'light', colorScheme: 'slate' };
const root = () => document.documentElement;

function renderSettings(saved: ThemeSelection = SAVED) {
  return render(<ThemeSettings saved={saved} />);
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Change' }));
  return screen.findByRole('dialog', { name: 'Appearance' });
}

beforeEach(() => {
  jest.clearAllMocks();
  updateSettings.mockImplementation((patch) =>
    Promise.resolve({ ...DEFAULT_USER_SETTINGS, ...patch })
  );
  useSettingsStore.getState().reset();
  useSettingsStore.setState({
    settings: { ...DEFAULT_USER_SETTINGS, ...SAVED },
    status: 'success',
  });
  root().removeAttribute('data-scheme');
  root().removeAttribute('data-mode');
  root().classList.remove('dark');
});

describe('ThemeSettings', () => {
  it('shows the saved scheme and mode', () => {
    renderSettings({ theme: 'system', colorScheme: 'rose' });

    expect(screen.getByText('Rose')).toBeInTheDocument();
    expect(screen.getByText('Same as the system')).toBeInTheDocument();
  });

  it('offers a live preview of every color scheme', async () => {
    const user = userEvent.setup();
    renderSettings();

    const dialog = await openDialog(user);

    const schemes = within(dialog).getByRole('radiogroup', {
      name: 'Color scheme',
    });
    const radios = within(schemes).getAllByRole('radio');
    expect(radios).toHaveLength(COLOR_SCHEMES.length);
    expect(within(schemes).getByRole('radio', { name: 'Slate' })).toBeChecked();
    // Each preview is painted with its own scheme's tokens.
    for (const scheme of COLOR_SCHEMES) {
      expect(
        dialog.querySelector(`[data-scheme="${scheme}"][data-mode="light"]`)
      ).toBeInTheDocument();
    }
  });

  it('switches the previews to dark with the mode', async () => {
    const user = userEvent.setup();
    renderSettings();
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole('radio', { name: 'Dark' }));

    expect(
      dialog.querySelectorAll('[data-mode="dark"][data-scheme]')
    ).toHaveLength(COLOR_SCHEMES.length);
  });

  it('tries a choice on the whole app before it is saved', async () => {
    const user = userEvent.setup();
    renderSettings();
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole('radio', { name: 'Violet' }));
    await user.click(within(dialog).getByRole('radio', { name: 'Dark' }));

    expect(root().dataset.scheme).toBe('violet');
    expect(root()).toHaveClass('dark');
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('puts the saved theme back on cancel', async () => {
    const user = userEvent.setup();
    renderSettings();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('radio', { name: 'Green' }));

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(root().dataset.scheme).toBe('slate');
    expect(root().dataset.mode).toBe('light');
    expect(updateSettings).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('saves the choice on apply', async () => {
    const user = userEvent.setup();
    renderSettings();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('radio', { name: 'Blue' }));
    await user.click(within(dialog).getByRole('radio', { name: 'Dark' }));

    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    expect(updateSettings).toHaveBeenCalledWith({
      theme: 'dark',
      colorScheme: 'blue',
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(useSettingsStore.getState().settings).toMatchObject({
      theme: 'dark',
      colorScheme: 'blue',
    });
  });

  it('keeps the dialog and the preview open when saving fails', async () => {
    updateSettings.mockRejectedValue(new Error('Service unavailable'));
    const user = userEvent.setup();
    renderSettings();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('radio', { name: 'Orange' }));

    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Service unavailable')
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(root().dataset.scheme).toBe('orange');
    expect(useSettingsStore.getState().settings?.colorScheme).toBe('slate');
  });

  it('puts the saved theme back if the page goes away mid-preview', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSettings();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('radio', { name: 'Red' }));

    unmount();

    expect(root().dataset.scheme).toBe('slate');
  });
});
