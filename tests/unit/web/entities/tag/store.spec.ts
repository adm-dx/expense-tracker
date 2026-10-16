import type { Tag } from '@expense-tracker/types';
import { renderHook } from '@testing-library/react';
import { useTagMap, useTagsStore } from '@web/entities/tag';
import { tagsApi } from '@web/shared/api/tags-api';
import { resetRegisteredStores } from '@web/shared/lib/store-reset';

jest.mock('@web/shared/api/tags-api', () => ({
  tagsApi: { list: jest.fn() },
}));

const list = tagsApi.list as jest.MockedFunction<typeof tagsApi.list>;

function makeTag(id: string, name: string): Tag {
  return {
    id,
    name,
    transactionCount: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  list.mockReset();
  useTagsStore.getState().reset();
});

describe('useTagsStore', () => {
  it('loads once unless forced', async () => {
    list.mockResolvedValue([makeTag('t1', 'Trip')]);

    await useTagsStore.getState().load();
    await useTagsStore.getState().load();
    expect(list).toHaveBeenCalledTimes(1);

    await useTagsStore.getState().load({ force: true });
    expect(list).toHaveBeenCalledTimes(2);
    expect(useTagsStore.getState()).toMatchObject({
      status: 'success',
      tags: [makeTag('t1', 'Trip')],
    });
  });

  it('records the error message on failure', async () => {
    list.mockRejectedValue(new Error('Network down'));

    await useTagsStore.getState().load();

    expect(useTagsStore.getState()).toMatchObject({
      status: 'error',
      error: 'Network down',
    });
  });

  it('is cleared with the session and drops a response in flight', async () => {
    let resolve!: (tags: Tag[]) => void;
    list.mockReturnValue(new Promise((res) => (resolve = res)));
    const pending = useTagsStore.getState().load();

    resetRegisteredStores();
    resolve([makeTag('t1', 'Trip')]);
    await pending;

    expect(useTagsStore.getState()).toMatchObject({ tags: [], status: 'idle' });
  });

  it('useTagMap looks tags up by id', () => {
    useTagsStore.setState({ tags: [makeTag('t1', 'Trip')] });

    const { result } = renderHook(() => useTagMap());

    expect(result.current.get('t1')?.name).toBe('Trip');
  });
});
