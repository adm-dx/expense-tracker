import type { Tag } from '@expense-tracker/types';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTagsStore } from '@web/entities/tag';
import { useTransactionsStore } from '@web/entities/transaction';
import { TagFilter } from '@web/features/transaction/tag-filter';
import { tagsApi } from '@web/shared/api/tags-api';

jest.mock('@web/shared/api/tags-api', () => ({
  tagsApi: { list: jest.fn() },
}));

const list = tagsApi.list as jest.MockedFunction<typeof tagsApi.list>;

function makeTag(id: string, name: string): Tag {
  return {
    id,
    name,
    transactionCount: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  list.mockReset();
  useTagsStore.getState().reset();
  useTransactionsStore.getState().reset();
});

describe('TagFilter', () => {
  it('renders nothing while the user has no tags', async () => {
    list.mockResolvedValue([]);
    const { container } = render(<TagFilter />);

    await waitFor(() => expect(useTagsStore.getState().status).toBe('success'));
    expect(container).toBeEmptyDOMElement();
  });

  it('sets and clears the tag of the transactions store', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue([makeTag('t1', 'Trip'), makeTag('t2', 'Work')]);
    useTransactionsStore.getState().setPage(4);
    render(<TagFilter />);

    const select = await screen.findByRole('combobox', { name: 'Tag' });
    expect(select).toHaveTextContent('All tags');

    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Work' }));
    expect(useTransactionsStore.getState()).toMatchObject({
      tagId: 't2',
      page: 1,
    });

    await user.click(screen.getByRole('combobox', { name: 'Tag' }));
    await user.click(await screen.findByRole('option', { name: 'All tags' }));
    expect(useTransactionsStore.getState().tagId).toBeNull();
  });
});
