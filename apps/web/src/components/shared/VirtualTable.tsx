import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';

interface VirtualTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  rowCount: number;
  isLoading: boolean;
  resource: string;
  onRowClick?: (row: TData) => void;
  onSelectionChange?: (selectedRows: TData[]) => void;
  enableColumnVisibility?: boolean;
  enableMultiSort?: boolean;
  pageSize?: number;
  emptyState?: React.ReactNode;
}

function parseSearchParams(search: any): Record<string, string> {
  const params: Record<string, string> = {};
  if (typeof search === 'string') {
    const query = search.startsWith('?') ? search.slice(1) : search;
    if (query) {
      for (const pair of query.split('&')) {
        const [key, ...rest] = pair.split('=');
        if (key) {
          params[decodeURIComponent(key)] = decodeURIComponent(rest.join('='));
        }
      }
    }
  } else if (search && typeof search === 'object') {
    for (const [k, v] of Object.entries(search)) {
      if (v !== undefined && v !== null) {
        params[k] = String(v);
      }
    }
  }
  return params;
}

export function VirtualTable<TData>({
  data,
  columns,
  rowCount,
  isLoading,
  resource,
  onRowClick,
  onSelectionChange,
  enableColumnVisibility = true,
  enableMultiSort = false,
  pageSize = 20,
  emptyState,
}: VirtualTableProps<TData>) {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => parseSearchParams(location.search), [location.search]);

  const [sorting, setSorting] = useState<SortingState>(() => {
    const sortParam = searchParams.sort;
    if (!sortParam) return [];
    return sortParam
      .split(',')
      .map((s) => {
        const [id, desc] = s.split(':');
        return id ? { id, desc: desc === 'desc' } : null;
      })
      .filter(Boolean) as SortingState;
  });

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const filterParam = searchParams.filter;
    return filterParam ? JSON.parse(decodeURIComponent(filterParam)) : [];
  });

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  useEffect(() => {
    const params: Record<string, string> = {};
    if (sorting.length > 0) {
      params.sort = sorting.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',');
    }
    if (columnFilters.length > 0) {
      params.filter = encodeURIComponent(JSON.stringify(columnFilters));
    }
    if (globalFilter) {
      params.search = globalFilter;
    }

    const currentSort = searchParams.sort ?? '';
    const currentFilter = searchParams.filter ?? '';
    const currentSearchVal = searchParams.search ?? '';

    const targetSort = params.sort ?? '';
    const targetFilter = params.filter ?? '';
    const targetSearchVal = params.search ?? '';

    if (
      currentSort !== targetSort ||
      currentFilter !== targetFilter ||
      currentSearchVal !== targetSearchVal
    ) {
      navigate({
        to: location.pathname,
        search: (prev: any) => ({
          ...prev,
          ...params,
        }),
        replace: true,
      });
    }
  }, [sorting, columnFilters, globalFilter, location.pathname, searchParams, navigate]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableMultiSort,
    manualPagination: true,
    rowCount,
    initialState: {
      pagination: { pageSize },
    },
  });

  useEffect(() => {
    const selected = table
      .getFilteredSelectedRowModel()
      .rows.map((row) => row.original);
    onSelectionChange?.(selected);
  }, [rowSelection, table, onSelectionChange]);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  const visibleColumns = table.getAllLeafColumns();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        {emptyState ?? (
          <div className="text-center">
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="rounded-md border border-input px-3 py-2 text-sm"
        />

        {enableColumnVisibility && (
          <div className="relative">
            <button
              className="rounded-md border border-input px-3 py-2 text-sm"
              onClick={(e) => {
                const menu = e.currentTarget.nextElementSibling;
                menu?.classList.toggle('hidden');
              }}
            >
              Columns
            </button>
            <div className="absolute right-0 top-full z-10 hidden rounded-md border bg-popover p-2 shadow-md">
              {visibleColumns
                .filter((col) => col.id !== 'select')
                .map((col) => (
                  <label key={col.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={col.getIsVisible()}
                      onChange={col.getToggleVisibilityHandler()}
                    />
                    {col.columnDef.header as string}
                  </label>
                ))}
            </div>
          </div>
        )}
      </div>

      <div ref={tableContainerRef} className="h-[600px] overflow-auto rounded-md border">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-left text-sm font-medium"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: ' ↑',
                        desc: ' ↓',
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              return (
                <tr
                  key={row.id}
                  className={`border-t ${
                    row.getIsSelected() ? 'bg-muted/50' : ''
                  } ${onRowClick ? 'cursor-pointer hover:bg-muted/30' : ''}`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} of {rowCount} rows
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </button>
          <span className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button
            className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
