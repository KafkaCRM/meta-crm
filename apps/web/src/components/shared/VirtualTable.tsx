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
  type ColumnSizingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import {
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { FilterChips } from './FilterChips';


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
  enableColumnResizing?: boolean;
  pageSize?: number;
  tableId?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyCta?: { label: string; onClick: () => void };
  emptyIcon?: React.ReactNode;
}

const ROW_HEIGHT = 44;
const SKELETON_COUNT = 5;

export function VirtualTable<TData>({
  data,
  columns,
  rowCount,
  isLoading,
  resource,
  onRowClick,
  onSelectionChange,
  enableColumnVisibility = true,
  enableMultiSort = true,
  enableColumnResizing = true,
  pageSize = 50,
  tableId = 'default-table',
  emptyTitle = 'No results found',
  emptyDescription = 'Try adjusting your filters or search terms',
  emptyCta,
  emptyIcon,
}: VirtualTableProps<TData>) {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => {
    const params: Record<string, string> = {};
    const search = location.search;
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
  }, [location.search]);

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
    if (!filterParam) return [];
    try {
      return JSON.parse(decodeURIComponent(filterParam));
    } catch {
      return [];
    }
  });

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(`table-cols-${tableId}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    try {
      const stored = localStorage.getItem(`table-size-${tableId}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`table-cols-${tableId}`, JSON.stringify(columnVisibility));
    } catch {
      // localStorage unavailable
    }
  }, [columnVisibility, tableId]);

  useEffect(() => {
    try {
      localStorage.setItem(`table-size-${tableId}`, JSON.stringify(columnSizing));
    } catch {
      // localStorage unavailable
    }
  }, [columnSizing, tableId]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (sorting.length > 0) {
      params.sort = sorting.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',');
    }
    if (columnFilters.length > 0) {
      params.filter = encodeURIComponent(JSON.stringify(columnFilters));
    }

    const currentSort = searchParams.sort ?? '';
    const currentFilter = searchParams.filter ?? '';
    const targetSort = params.sort ?? '';
    const targetFilter = params.filter ?? '';

    if (currentSort !== targetSort || currentFilter !== targetFilter) {
      navigate({
        to: location.pathname,
        search: (prev: any) => ({
          ...(prev ?? {}),
          ...params,
        }),
        replace: true,
      });
    }
  }, [sorting, columnFilters, location.pathname, searchParams, navigate]);

  const selectColumn: ColumnDef<TData> = useMemo(
    () => ({
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate' as any)
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      size: 40,
      enableResizing: false,
    }),
    [],
  );

  const allColumns = useMemo(
    () => [selectColumn, ...columns],
    [selectColumn, columns],
  );

  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableMultiSort,
    enableColumnResizing,
    columnResizeMode: 'onChange',
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
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  const selectedCount = Object.keys(rowSelection).length;

  const visibleColumns = table.getAllLeafColumns().filter((col) => col.getIsVisible());

  if (isLoading) {
    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-[#f8fafc]">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  className="px-4 py-2.5 text-left text-xs font-medium text-[#94a3b8] uppercase tracking-wider border-b border-[#e2e8f0]"
                  style={{ width: col.getSize() }}
                >
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <tr key={i} className="border-b border-[#e2e8f0]/40">
                {visibleColumns.map((col) => (
                  <td key={col.id} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        {emptyIcon ?? (
          <div className="w-12 h-12 rounded-full bg-[#f8fafc] flex items-center justify-center mb-4">
            <Search size={20} className="text-[#94a3b8]" />
          </div>
        )}
        <h3 className="text-base font-medium text-[#0f172a] mb-1">{emptyTitle}</h3>
        <p className="text-sm text-[#94a3b8] mb-4">{emptyDescription}</p>
        {emptyCta && (
          <Button
            onClick={emptyCta.onClick}
            className="bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-lg h-8 px-4 text-sm font-medium"
          >
            {emptyCta.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {enableColumnVisibility && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <span className="text-sm font-medium text-[#0f172a]">
                {selectedCount} {selectedCount === 1 ? 'row' : 'rows'} selected
              </span>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a]"
              >
                <Eye size={13} className="mr-1.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {table
                .getAllLeafColumns()
                .filter((col) => col.id !== 'select')
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={(value) => col.toggleVisibility(!!value)}
                  >
                    {typeof col.columnDef.header === 'string'
                      ? col.columnDef.header
                      : col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <FilterChips 
        filters={columnFilters} 
        onRemove={(id) => setColumnFilters(prev => prev.filter(f => f.id !== id))} 
        onClearAll={() => setColumnFilters([])} 
      />

      <div
        ref={tableContainerRef}
        className="overflow-auto rounded-lg border border-[#e2e8f0] max-h-[600px]"
        style={{ width: '100%' }}
      >
        <table className="w-full" style={{ minWidth: table.getCenterTotalSize() }}>
          <thead className="sticky top-0 z-10 bg-[#f8fafc]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="relative px-4 py-2.5 text-left text-xs font-medium text-[#94a3b8] uppercase tracking-wider border-b border-[#e2e8f0] select-none"
                    style={{ width: header.getSize() }}
                  >
                    <div
                      className="flex items-center gap-1 cursor-pointer"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-[#94a3b8]">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp size={13} />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ChevronDown size={13} />
                          ) : (
                            <ChevronsUpDown size={13} />
                          )}
                        </span>
                      )}
                    </div>
                    {enableColumnResizing && header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-[#e2e8f0] transition-colors"
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td
                  style={{ height: `${paddingTop}px` }}
                  colSpan={visibleColumns.length}
                />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              const isEven = virtualRow.index % 2 === 0;
              return (
                <tr
                  key={row.id}
                  className={`border-b border-[#e2e8f0]/40 transition-colors ${
                    row.getIsSelected()
                      ? 'bg-[#3b82f6]/5'
                      : isEven
                        ? 'bg-white'
                        : 'bg-[#faf9f7]'
                  } ${onRowClick ? 'cursor-pointer hover:bg-[#f8fafc]' : ''}`}
                  onClick={() => onRowClick?.(row.original)}
                  style={{ height: `${ROW_HEIGHT}px` }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5 text-sm text-[#64748b]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td
                  style={{ height: `${paddingBottom}px` }}
                  colSpan={visibleColumns.length}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-[#94a3b8]">
        <span>
          {table.getFilteredRowModel().rows.length} of {rowCount} rows
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-7 text-xs border-[#e2e8f0]"
          >
            Previous
          </Button>
          <span className="text-xs">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-7 text-xs border-[#e2e8f0]"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
