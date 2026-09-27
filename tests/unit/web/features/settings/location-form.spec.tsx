import {
  DEFAULT_USER_SETTINGS,
  type LocationSetting,
  type Place,
} from '@expense-tracker/types';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { useSettingsStore } from '@web/entities/settings';
import { LocationForm } from '@web/features/settings/location';
import { settingsApi } from '@web/shared/api/settings-api';
import { weatherApi } from '@web/shared/api/weather-api';

jest.mock('@web/shared/api/settings-api', () => ({
  settingsApi: { get: jest.fn(), update: jest.fn() },
}));
jest.mock('@web/shared/api/weather-api', () => ({
  weatherApi: { get: jest.fn(), searchPlaces: jest.fn() },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const updateSettings = settingsApi.update as jest.MockedFunction<
  typeof settingsApi.update
>;
const searchPlaces = weatherApi.searchPlaces as jest.MockedFunction<
  typeof weatherApi.searchPlaces
>;

const PLACES: Place[] = [
  { name: 'Novi Sad, RS', lat: 45.2517, lon: 19.8369 },
  { name: 'Novi Pazar, RS', lat: 43.1367, lon: 20.5122 },
];
const NOVI_SAD: LocationSetting = {
  mode: 'manual',
  name: 'Novi Sad, RS',
  lat: 45.25,
  lon: 19.84,
};

function renderForm(location: LocationSetting) {
  useSettingsStore.setState({
    settings: { ...DEFAULT_USER_SETTINGS, location },
    status: 'success',
  });
  return render(<LocationForm value={location} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.getState().reset();
  updateSettings.mockImplementation((patch) =>
    Promise.resolve({ ...DEFAULT_USER_SETTINGS, ...patch })
  );
  searchPlaces.mockResolvedValue(PLACES);
});

describe('LocationForm', () => {
  it('starts on the browser position', () => {
    renderForm({ mode: 'auto' });

    expect(screen.getByRole('radio', { name: 'My position' })).toBeChecked();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('searches only when asked, never while typing', async () => {
    const user = userEvent.setup();
    renderForm({ mode: 'auto' });
    await user.click(screen.getByRole('radio', { name: 'A chosen town' }));

    await user.type(screen.getByRole('textbox', { name: 'Town' }), 'Novi');
    expect(searchPlaces).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(searchPlaces).toHaveBeenCalledWith('Novi');
    expect(
      await screen.findByRole('button', { name: 'Novi Sad, RS' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '© OpenStreetMap contributors' })
    ).toBeInTheDocument();
  });

  it('keeps the search button disabled for a one-letter query', async () => {
    const user = userEvent.setup();
    renderForm({ mode: 'auto' });
    await user.click(screen.getByRole('radio', { name: 'A chosen town' }));

    await user.type(screen.getByRole('textbox', { name: 'Town' }), 'N');

    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  });

  it('saves the town that is picked', async () => {
    const user = userEvent.setup();
    renderForm({ mode: 'auto' });
    await user.click(screen.getByRole('radio', { name: 'A chosen town' }));
    await user.type(screen.getByRole('textbox', { name: 'Town' }), 'Novi{Enter}');

    await user.click(await screen.findByRole('button', { name: 'Novi Sad, RS' }));

    expect(updateSettings).toHaveBeenCalledWith({
      location: { mode: 'manual', ...PLACES[0] },
    });
  });

  it('says so when nothing is found', async () => {
    searchPlaces.mockResolvedValue([]);
    const user = userEvent.setup();
    renderForm({ mode: 'auto' });
    await user.click(screen.getByRole('radio', { name: 'A chosen town' }));

    await user.type(screen.getByRole('textbox', { name: 'Town' }), 'Atlantis{Enter}');

    expect(await screen.findByText(/No towns found/)).toBeInTheDocument();
  });

  it('shows why the search failed', async () => {
    searchPlaces.mockRejectedValue(new Error('Place search is unavailable'));
    const user = userEvent.setup();
    renderForm({ mode: 'auto' });
    await user.click(screen.getByRole('radio', { name: 'A chosen town' }));

    await user.type(screen.getByRole('textbox', { name: 'Town' }), 'Novi{Enter}');

    expect(
      await screen.findByText('Place search is unavailable')
    ).toBeInTheDocument();
  });

  it('shows the chosen town and lets the user replace it', async () => {
    const user = userEvent.setup();
    renderForm(NOVI_SAD);

    expect(screen.getByRole('radio', { name: 'A chosen town' })).toBeChecked();
    expect(screen.getByText('Novi Sad, RS')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change town' }));
    expect(screen.getByRole('textbox', { name: 'Town' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('switches back to the browser position', async () => {
    const user = userEvent.setup();
    renderForm(NOVI_SAD);

    await user.click(screen.getByRole('radio', { name: 'My position' }));

    expect(updateSettings).toHaveBeenCalledWith({ location: { mode: 'auto' } });
  });

  it('does not save anything for choosing a town mode without a town', async () => {
    const user = userEvent.setup();
    renderForm({ mode: 'auto' });

    await user.click(screen.getByRole('radio', { name: 'A chosen town' }));
    await user.click(screen.getByRole('radio', { name: 'My position' }));

    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('reports a failed save', async () => {
    updateSettings.mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderForm(NOVI_SAD);

    await user.click(screen.getByRole('radio', { name: 'My position' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('down'));
  });
});
