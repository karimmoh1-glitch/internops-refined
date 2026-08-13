import { useState } from "react";
import { Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface FilterOption {
  value: string;
  label: string;
  color?: string;
}

interface SearchFilterBarProps {
  placeholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filterOptions?: FilterOption[];
  activeFilter?: string | null;
  onFilterChange?: (value: string | null) => void;
  resultCount?: number;
}

export default function SearchFilterBar({
  placeholder = "Search...",
  searchValue,
  onSearchChange,
  filterOptions,
  activeFilter,
  onFilterChange,
  resultCount,
}: SearchFilterBarProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row gap-2 mb-4">
      <div className={`relative flex-1 transition-all duration-200 ${focused ? "ring-2 ring-blue-200 rounded-lg" : ""}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="pl-9 pr-8 h-9 text-sm border-white/[0.08]"
          data-testid="search-input"
        />
        {searchValue && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-white/40 hover:text-white/70 rounded"
            data-testid="search-clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {filterOptions && filterOptions.length > 0 && onFilterChange && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-white/40 hidden sm:block" />
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFilterChange(activeFilter === opt.value ? null : opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 border ${
                activeFilter === opt.value
                  ? opt.color || "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-[#141110] text-white/50 border-white/[0.08] hover:border-white/20 hover:bg-[#141110]/[0.06]"
              }`}
              data-testid={`filter-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
          {activeFilter && (
            <button
              onClick={() => onFilterChange(null)}
              className="px-2 py-1 text-xs text-white/40 hover:text-red-500 transition-colors"
              data-testid="filter-clear"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {resultCount !== undefined && (searchValue || activeFilter) && (
        <span className="text-xs text-white/40 self-center whitespace-nowrap" data-testid="search-result-count">
          {resultCount} result{resultCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
