'use client';

import type { Category } from '@expense-tracker/types';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DeleteCategoryDialog } from '@/features/category/delete';
import { CategoryDialog } from '@/features/category/upsert';
import { CategoryIcon, useCategoriesStore } from '@/entities/category';
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

type RowAction = { kind: 'edit' | 'delete'; category: Category } | null;

export function CategoriesList() {
  const categories = useCategoriesStore((state) => state.categories);
  const status = useCategoriesStore((state) => state.status);
  const error = useCategoriesStore((state) => state.error);
  const load = useCategoriesStore((state) => state.load);
  const [action, setAction] = useState<RowAction>(null);
  // Kept separately so dialog content doesn't vanish during the close animation.
  const [selected, setSelected] = useState<Category>();

  // Always refetch: transaction counts change as transactions are added.
  useEffect(() => {
    void load({ force: true });
  }, [load]);

  function openAction(kind: 'edit' | 'delete', category: Category) {
    setSelected(category);
    setAction({ kind, category });
  }

  function handleOpenChange(open: boolean) {
    if (!open) setAction(null);
  }

  const isInitialLoading =
    (status === 'loading' || status === 'idle') && categories.length === 0;

  return (
    <div className="space-y-4">
      {status === 'error' && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            {error ?? 'Failed to load categories'}
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
          status === 'loading' && categories.length > 0 && 'opacity-60'
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="w-[52px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInitialLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={COLUMN_COUNT}>
                    <div className="h-5 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))}
            {status === 'success' && categories.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="h-24 text-center text-muted-foreground"
                >
                  No categories yet
                </TableCell>
              </TableRow>
            )}
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <CategoryIcon icon={category.icon} />
                    </span>
                    <span className="font-medium">{category.name}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {category.transactionCount}
                </TableCell>
                <TableCell>
                  {/* Non-modal so opening a dialog from it doesn't leave the page inert. */}
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Actions for ${category.name}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => openAction('edit', category)}
                      >
                        <Pencil />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => openAction('delete', category)}
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
      <CategoryDialog
        open={action?.kind === 'edit'}
        onOpenChange={handleOpenChange}
        category={selected}
      />
      <DeleteCategoryDialog
        open={action?.kind === 'delete'}
        onOpenChange={handleOpenChange}
        category={selected}
      />
    </div>
  );
}
