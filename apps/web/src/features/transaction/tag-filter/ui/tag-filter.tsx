'use client';

import { useEffect, useId } from 'react';
import { useTagsStore } from '@/entities/tag';
import { useTransactionsStore } from '@/entities/transaction';
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui';

// Radix Select can't hold an empty value, so "all tags" gets a sentinel.
const ALL_TAGS = 'all';

/** The tag shared by the transactions table and the summary cards. */
export function TagFilter() {
  const id = useId();
  const tags = useTagsStore((state) => state.tags);
  const loadTags = useTagsStore((state) => state.load);
  const tagId = useTransactionsStore((state) => state.tagId);
  const setTagId = useTransactionsStore((state) => state.setTagId);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  // Without tags there is nothing to filter by; keep a chosen one visible
  // only while it is still in the list.
  if (tags.length === 0 && tagId === null) return null;
  const value =
    tagId !== null && tags.some((tag) => tag.id === tagId) ? tagId : ALL_TAGS;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-tag`}>Tag</Label>
      <Select
        value={value}
        onValueChange={(next) => setTagId(next === ALL_TAGS ? null : next)}
      >
        <SelectTrigger id={`${id}-tag`} className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TAGS}>All tags</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              {tag.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
