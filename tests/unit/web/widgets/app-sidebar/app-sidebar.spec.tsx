import { render, screen, within } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { useSessionStore } from '@web/entities/session/model/store';
import { AppSidebar } from '@web/widgets/app-sidebar';

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }));

const pathname = jest.mocked(usePathname);

beforeEach(() => {
  pathname.mockReturnValue('/');
  useSessionStore.setState({
    user: { id: 'user-a', email: 'ada@example.com', name: 'Ada Lovelace' },
  });
});

function navLink(name: string) {
  return within(screen.getByRole('navigation', { name: 'Main' })).getByRole(
    'link',
    { name }
  );
}

describe('AppSidebar', () => {
  it('links the signed-in user to their profile', () => {
    render(<AppSidebar />);

    const profile = screen.getByRole('link', { name: /Ada Lovelace/ });
    expect(profile).toHaveAttribute('href', '/profile');
    expect(profile).toHaveTextContent('ada@example.com');
    expect(profile).toHaveTextContent('AL');
  });

  it('links every section', () => {
    render(<AppSidebar />);

    expect(navLink('Home')).toHaveAttribute('href', '/');
    expect(navLink('Categories')).toHaveAttribute('href', '/categories');
    expect(navLink('Reports')).toHaveAttribute('href', '/reports');
    expect(navLink('Settings')).toHaveAttribute('href', '/settings');
  });

  it('marks only Home as current on the home page', () => {
    render(<AppSidebar />);

    expect(navLink('Home')).toHaveAttribute('aria-current', 'page');
    expect(navLink('Reports')).not.toHaveAttribute('aria-current');
  });

  it('marks a section as current on its nested pages', () => {
    pathname.mockReturnValue('/reports/monthly');
    render(<AppSidebar />);

    expect(navLink('Reports')).toHaveAttribute('aria-current', 'page');
    expect(navLink('Home')).not.toHaveAttribute('aria-current');
  });

  it('does not treat a shared prefix as a nested page', () => {
    pathname.mockReturnValue('/settingsx');
    render(<AppSidebar />);

    expect(navLink('Settings')).not.toHaveAttribute('aria-current');
  });

  it('marks the profile link as current on the profile page', () => {
    pathname.mockReturnValue('/profile');
    render(<AppSidebar />);

    expect(screen.getByRole('link', { name: /Ada Lovelace/ })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
