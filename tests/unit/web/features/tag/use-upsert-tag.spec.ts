import type { Tag } from '@expense-tracker/types';
import { act, renderHook } from '@testing-library/react';
import { useTagsStore } from '@web/entities/tag';
import { tagSchema } from '@web/features/tag/upsert/model/schema';
import { useUpsertTag } from '@web/features/tag/upsert/model/use-upsert-tag';
import { ApiError } from '@web/shared/api/http-client';
import { tagsApi } from '@web/shared/api/tags-api';
import { toast } from 'sonner';

jest.mock('@web/shared/api/tags-api', () => ({
  tagsApi: { list: jest.fn(), create: jest.fn(), update: jest.fn() },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const api = tagsApi as jest.Mocked<typeof tagsApi>;

const existing: Tag = {
  id: 'tag-1',
  name: 'Trip',
  transactionCount: 2,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

async function submit(
  name: string,
  options: Parameters<typeof useUpsertTag>[0] = {}
) {
  const { result } = renderHook(() => useUpsertTag(options));
  await act(async () => {
    await result.current.submit({ name });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  api.list.mockResolvedValue([]);
  api.create.mockResolvedValue(existing);
  api.update.mockResolvedValue(existing);
  useTagsStore.getState().reset();
});

describe('tagSchema', () => {
  it('trims the name and requires 1 to 50 characters', () => {
    expect(tagSchema.parse({ name: '  Trip ' })).toEqual({ name: 'Trip' });
    expect(tagSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(tagSchema.safeParse({ name: 'x'.repeat(51) }).success).toBe(false);
  });
});

describe('useUpsertTag', () => {
  it('creates a tag, closes and reloads the tags', async () => {
    const onSuccess = jest.fn();

    await submit('Trip', { onSuccess });

    expect(api.create).toHaveBeenCalledWith({ name: 'Trip' });
    expect(toast.success).toHaveBeenCalledWith('Tag added');
    expect(onSuccess).toHaveBeenCalled();
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('renames only when the name changed', async () => {
    await submit('Trip', { tag: existing });
    expect(api.update).not.toHaveBeenCalled();

    await submit('Holiday', { tag: existing });
    expect(api.update).toHaveBeenCalledWith('tag-1', { name: 'Holiday' });
  });

  it('keeps the dialog open and shows the error on a duplicate', async () => {
    const onSuccess = jest.fn();
    api.create.mockRejectedValue(
      new ApiError(409, ['Tag with this name already exists'])
    );

    await submit('Trip', { onSuccess });

    expect(toast.error).toHaveBeenCalledWith(
      'Tag with this name already exists'
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
