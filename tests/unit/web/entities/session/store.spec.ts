import type { Category, TransactionListItem } from '@expense-tracker/types';
import { useCategoriesStore } from '@web/entities/category/model/store';
import { useSessionStore } from '@web/entities/session/model/store';
import { useSummaryStore } from '@web/entities/transaction/model/summary-store';
import { useTransactionsStore } from '@web/entities/transaction/model/store';

const session = {
  accessToken: 'access',
  refreshToken: 'refresh',
  user: { id: 'user-a', email: 'a@example.com', name: 'Ann' },
};

const category: Category = {
  id: 'cat-a',
  name: 'Food',
  color: '#F97316',
  icon: 'utensils',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const transaction: TransactionListItem = {
  id: 'tx-a',
  amount: '12.50',
  currency: 'RSD',
  convertedAmount: '12.50',
  type: 'EXPENSE',
  description: null,
  date: '2026-09-10T00:00:00.000Z',
  categoryId: 'cat-a',
  createdAt: '2026-09-10T00:00:00.000Z',
};

/** Fills the domain stores as if user A had been browsing. */
function fillDomainStores() {
  useCategoriesStore.setState({ categories: [category], status: 'success' });
  useTransactionsStore.setState({
    items: [transaction],
    total: 1,
    page: 3,
    status: 'success',
  });
  useSummaryStore.setState({
    summary: {
      dateFrom: '2026-09-01T00:00:00.000Z',
      dateTo: '2026-09-30T23:59:59.999Z',
      totalIncome: '0.00',
      totalExpense: '12.50',
      balance: '-12.50',
      byCategory: [],
      currency: 'RSD',
      ratesDate: null,
    },
    status: 'success',
  });
}

beforeEach(() => {
  useSessionStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
  });
  useCategoriesStore.getState().reset();
  useTransactionsStore.getState().reset();
  useSummaryStore.getState().reset();
});

describe('useSessionStore', () => {
  it('stores the session on setSession', () => {
    useSessionStore.getState().setSession(session);

    expect(useSessionStore.getState()).toMatchObject({
      user: session.user,
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('clears the session on clearSession', () => {
    useSessionStore.getState().setSession(session);

    useSessionStore.getState().clearSession();

    expect(useSessionStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  });

  it('setTokens swaps the tokens and keeps the user', () => {
    useSessionStore.getState().setSession(session);

    useSessionStore
      .getState()
      .setTokens({ accessToken: 'new-access', refreshToken: 'new-refresh' });

    expect(useSessionStore.getState()).toMatchObject({
      user: session.user,
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
  });
});

describe('domain stores across session changes', () => {
  it('are emptied on clearSession (logout, or a failed token refresh)', () => {
    useSessionStore.getState().setSession(session);
    fillDomainStores();

    useSessionStore.getState().clearSession();

    expect(useCategoriesStore.getState()).toMatchObject({
      categories: [],
      status: 'idle',
    });
    expect(useTransactionsStore.getState()).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      status: 'idle',
    });
    expect(useSummaryStore.getState()).toMatchObject({
      summary: null,
      status: 'idle',
    });
  });

  it("do not leak user A's data to user B signing in on the same tab", () => {
    // A's session dies without a logout (e.g. the refresh token expired),
    // then B signs in: nothing of A may be left behind.
    useSessionStore.getState().setSession(session);
    fillDomainStores();

    useSessionStore.getState().setSession({
      accessToken: 'b-access',
      refreshToken: 'b-refresh',
      user: { id: 'user-b', email: 'b@example.com', name: 'Bob' },
    });

    expect(useCategoriesStore.getState().categories).toEqual([]);
    expect(useTransactionsStore.getState().items).toEqual([]);
    expect(useSummaryStore.getState().summary).toBeNull();
    expect(useSessionStore.getState().user?.id).toBe('user-b');
  });
});
