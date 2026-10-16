'use client';

import type { Tag } from '@expense-tracker/types';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DeleteTagDialog } from '@/features/tag/delete';
import { TagDialog } from '@/features/tag/upsert';
import { TagBadge, useTagsStore } from '@/entities/tag';
import { cn } from '@/shared/lib/utils';
import {
  Alert,
  AlertDescription,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui';

const COLUMN_COUNT = 3;

type RowAction = { kind: 'edit' | 'delete'; tag: Tag } | null;

export function TagsList() {
  const tags = useTagsStore((state) => state.tags);
  const status = useTagsStore((state) => state.status);
  const error = useTagsStore((state) => state.error);
  const load = useTagsStore((state) => state.load);
  const [action, setAction] = useState<RowAction>(null);
  // Kept separately so dialog content doesn't vanish during the close animation.
  const [selected, setSelected] = useState<Tag>();

  // Always refetch: transaction counts change as transactions are tagged.
  useEffect(() => {
    void load({ force: true });
  }, [load]);

  function openAction(kind: 'edit' | 'delete', tag: Tag) {
    setSelected(tag);
    setAction({ kind, tag });
  }

  function handleOpenChange(open: boolean) {
    if (!open) setAction(null);
  }

  const isInitialLoading =
    (status === 'loading' || status === 'idle') && tags.length === 0;

  return (
    <div className="space-y-4">
      {status === 'error' && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            {error ?? 'Failed to load tags'}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load({ force: true })}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div
        className={cn(
          'rounded-md border transition-opacity',
          status === 'loading' && tags.length > 0 && 'opacity-60'
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tag</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="w-[52px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInitialLoading &&
              Array.from({ length: 3 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={COLUMN_COUNT}>
                    <div className="h-5 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))}
            {status === 'success' && tags.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="h-24 text-center text-muted-foreground"
                >
                  No tags yet
                </TableCell>
              </TableRow>
            )}
            {tags.map((tag) => (
              <TableRow key={tag.id}>
                <TableCell>
                  <TagBadge name={tag.name} />
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {tag.transactionCount}
                </TableCell>
                <TableCell>
                  {/* Non-modal so opening a dialog from it doesn't leave the page inert. */}
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Actions for ${tag.name}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => openAction('edit', tag)}
                      >
                        <Pencil />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => openAction('delete', tag)}
                      >
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TagDialog
        open={action?.kind === 'edit'}
        onOpenChange={handleOpenChange}
        tag={selected}
      />
      <DeleteTagDialog
        open={action?.kind === 'delete'}
        onOpenChange={handleOpenChange}
        tag={selected}
      />
    </div>
  );
}
