import { useMemo, useState } from "react";

interface UsePaginatedListOptions<T> {
  items: T[];
  pageSize?: number;
}

interface UsePaginatedListResult<T> {
  page: number;
  setPage: (page: number) => void;
  pageItems: T[];
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage: () => void;
  prevPage: () => void;
  goToFirst: () => void;
  goToLast: () => void;
}

export function usePaginatedList<T>({ items, pageSize = 10 }: UsePaginatedListOptions<T>): UsePaginatedListResult<T> {
  const [page, setPage] = useState(1);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const hasNext = safePage < totalPages;
  const hasPrev = safePage > 1;

  return {
    page: safePage,
    setPage: (p: number) => setPage(Math.max(1, Math.min(p, totalPages))),
    pageItems,
    totalPages,
    totalItems,
    hasNext,
    hasPrev,
    nextPage: () => setPage((p) => Math.min(p + 1, totalPages)),
    prevPage: () => setPage((p) => Math.max(p - 1, 1)),
    goToFirst: () => setPage(1),
    goToLast: () => setPage(totalPages),
  };
}
