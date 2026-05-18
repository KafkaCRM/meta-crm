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
import { useRef, useEffect, useState, useCallback } from 'react';

interface VirtualTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  rowCount: number;
  isLoading: boolean;
  onRowClick?: (row: TData) => void;
  onSelectionChange?: (selectedRows: TData[]) => void;
  enableColumnVisibility?: boolean;
  enableMultiSort?: boolean;
  pageSize?: number;
  emptyState?: React.ReactNode;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
}

export function VirtualTable<TData>({
  data,
  columns,
  rowCount,
  isLoading,
  onRowClick,
  onSelectionChange,
  enableColumnVisibility = true,
  enableMultiSort = false,
  pageSize = 20,
  emptyState,
  searchPlaceholder = 'Search...',
  onSearchChange,
  searchValue,
}: VirtualTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState(searchValue ?? '');

  useEffect(() => {
    if (searchValue !== undefined) {
      setGlobalFilter(searchValue);
    }
  }, [searchValue]);

  useEffect(() => {
    onSearchChange?.(globalFilter);
  }, [globalFilter, onSearchChange]);

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

  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  const handleColumnMenuToggle = useCallback(() => {
    setColumnMenuOpen((prev) => !prev);
  }, []);

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
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="rounded-md border border-input px-3 py-2 text-sm"
        />

        {enableColumnVisibility && (
          <div className="relative">
            <button
              type="button"
              className="rounded-md border border-input px-3 py-2 text-sm"
              onClick={handleColumnMenuToggle}
            >
              Columns
            </button>
            {columnMenuOpen && (
              <div className="absolute right-0 top-full z-10 rounded-md border bg-white p-2 shadow-md">
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
            )}
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
