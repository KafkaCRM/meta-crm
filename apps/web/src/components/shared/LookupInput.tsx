import { useState, useEffect, useRef } from 'react';
import { apiCall } from '@/lib/api';
import { Search, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface LookupItem {
  id: string;
  label: string;
  subtext?: string;
}

interface LookupInputProps {
  value: string;
  onChange: (val: string) => void;
  relatedTo: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function LookupInput({
  value,
  onChange,
  relatedTo,
  placeholder = 'Search...',
  disabled = false,
  className = '',
}: LookupInputProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<LookupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasResolvedInitial, setHasResolvedInitial] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Resolve initial ID value to friendly display label
  useEffect(() => {
    if (value && !hasResolvedInitial) {
      setIsLoading(true);
      apiCall<LookupItem[]>(`/metadata/lookup/search?relatedTo=${relatedTo}&q=${value}`)
        .then((items) => {
          const match = items.find((item) => item.id === value);
          if (match) {
            setSelectedLabel(match.label);
          } else {
            setSelectedLabel(value);
          }
          setHasResolvedInitial(true);
        })
        .catch(() => {
          setSelectedLabel(value);
          setHasResolvedInitial(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (!value) {
      setSelectedLabel('');
      setHasResolvedInitial(true);
    }
  }, [value, relatedTo, hasResolvedInitial]);

  // Perform search query when debounced search term changes
  useEffect(() => {
    if (!isOpen || value) return;

    let active = true;
    setIsLoading(true);

    apiCall<LookupItem[]>(`/metadata/lookup/search?relatedTo=${relatedTo}&q=${debouncedSearch}`)
      .then((items) => {
        if (active) {
          setResults(items);
        }
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, relatedTo, isOpen, value]);

  // Handle clicking outside to close the dropdown list
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: LookupItem) => {
    setSelectedLabel(item.label);
    onChange(item.id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    setSelectedLabel('');
    onChange('');
    setSearchTerm('');
    setResults([]);
    setIsOpen(true);
  };

  if (disabled) {
    return (
      <div className={`relative w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground ${className}`}>
        {selectedLabel || value || placeholder}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {value ? (
        // Salesforce style: selected value display with clear (X) trigger button
        <div className="flex h-9 w-full items-center justify-between rounded-lg border border-[#3b82f6] bg-blue-50/50 px-3 py-2 text-sm text-blue-900 transition-colors">
          <span className="font-medium truncate">{selectedLabel || value}</span>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        // Active search state
        <div className="relative">
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="pl-9 pr-8 h-9 rounded-lg border-border focus-visible:ring-1 focus-visible:ring-[#0f172a]"
          />
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {/* Glassmorphic Dropdown Overlay */}
      {isOpen && !value && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border/80 bg-card/95 backdrop-blur-md p-1 shadow-lg focus:outline-none animate-in fade-in slide-in-from-top-1 duration-150">
          {isLoading && results.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-foreground" />
              Searching records...
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No matching records found in {relatedTo}
            </div>
          ) : (
            <div className="space-y-0.5">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="flex flex-col text-left w-full px-3 py-2 text-sm rounded-md hover:bg-muted/70/80 hover:text-foreground transition-colors focus:bg-slate-100 focus:outline-none"
                >
                  <span className="font-medium text-foreground truncate">{item.label}</span>
                  {item.subtext && (
                    <span className="text-xs text-muted-foreground truncate mt-0.5">{item.subtext}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
