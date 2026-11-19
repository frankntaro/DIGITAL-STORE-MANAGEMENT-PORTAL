import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../utils/i18n';

/**
 * Reusable client-side pagination hook for tables, lists, and product grids.
 * Automatically resets to page 1 when `resetKey` or `pageSize` changes.
 */
export function usePagination(items = [], defaultPageSize = 5, resetKey = '') {
  const list = Array.isArray(items) ? items : [];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * pageSize;
  const endIndex = Math.min(totalItems, startIndex + pageSize);

  const pageItems = useMemo(
    () => list.slice(startIndex, endIndex),
    [list, startIndex, endIndex]
  );

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    pageItems,
    paginationProps: {
      page: safePage,
      totalPages,
      totalItems,
      startIndex,
      endIndex,
      pageSize,
      onPageChange: setPage,
      onPageSizeChange: setPageSize,
    },
  };
}

function buildPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }
  const pages = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    pages.push('ellipsis-left');
  }
  for (let p = windowStart; p <= windowEnd; p += 1) {
    pages.push(p);
  }
  if (windowEnd < totalPages - 1) {
    pages.push('ellipsis-right');
  }
  pages.push(totalPages);
  return pages;
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  pageSize,
  pageSizeOptions = [5, 10, 15, 25, 50],
  onPageChange,
  onPageSizeChange,
  standalone = false,
  hideWhenSinglePage = false,
}) {
  const { t } = useLanguage();

  if (!totalItems || totalItems <= 0) return null;
  if (hideWhenSinglePage && totalPages <= 1) return null;

  const normalizedOptions = Array.from(
    new Set([...pageSizeOptions, pageSize])
  ).sort((a, b) => a - b);

  const pageNumbers = buildPageNumbers(page, totalPages);

  return (
    <nav
      aria-label={t('Pagination')}
      className={
        standalone
          ? 'bg-white rounded-2xl border border-slate-200 px-3 sm:px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 text-xs'
          : 'bg-slate-50 border-t border-slate-200 px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 text-xs'
      }
    >
      {/* Left: Range summary & page-size selector */}
      <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5 sm:gap-3 text-slate-600">
        <span className="font-semibold">
          {t('Showing {start}–{end} of {total}', {
            start: startIndex + 1,
            end: endIndex,
            total: totalItems,
          })}
        </span>
        {onPageSizeChange && (
          <label className="inline-flex items-center gap-1.5 font-medium">
            <span>{t('Per page:')}</span>
            <select
              aria-label={t('Items per page')}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold text-xs"
            >
              {normalizedOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Right: Previous / Page numbers / Next */}
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label={t('Previous page')}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('Previous')}</span>
        </button>

        {pageNumbers.map((item) =>
          typeof item === 'string' ? (
            <span key={item} className="px-2 py-1 text-slate-400 font-bold select-none">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-label={t('Page {page}', { page: item })}
              aria-current={item === page ? 'page' : undefined}
              className={`min-w-[30px] px-2.5 py-1.5 rounded-lg font-extrabold transition ${
                item === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
              }`}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          aria-label={t('Next page')}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <span className="hidden sm:inline">{t('Next')}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  );
}
