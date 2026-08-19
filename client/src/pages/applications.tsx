import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Inbox, Search } from "lucide-react";
import SearchFilterBar from "@/components/search-filter-bar";
import { SimplePageSkeleton } from "@/components/dashboard-skeleton";
import { ApplicationRow, type Application } from "@/components/applications-panel";

const FILTERS = [
  { value: "pending", label: "Pending", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "approved", label: "Approved", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "rejected", label: "Rejected", color: "bg-white/10 text-white/50 border-white/[0.08]" },
  { value: "dismissed", label: "Dismissed", color: "bg-white/10 text-white/50 border-white/[0.08]" },
];

export default function ApplicationsHistory() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const { data: applications = [], isLoading } = useQuery<Application[]>({ queryKey: ["/api/applications"] });

  const filtered = useMemo(() => {
    return [...applications]
      .filter((a) => {
        if (filter === "dismissed") return !!a.dismissedAt;
        if (filter) return a.status === filter;
        return true;
      })
      .filter((a) => !search.trim() || a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [applications, filter, search]);

  if (isLoading) return <SimplePageSkeleton rows={5} />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-2.5">
          <ClipboardList className="w-6 h-6 text-[#6D5EF5]" />
          <div>
            <h1 className="text-2xl font-bold text-white" data-testid="text-applications-history-title">Application History</h1>
            <p className="text-sm text-white/50 mt-0.5">Every application ever received, including dismissed ones.</p>
          </div>
        </div>

        <SearchFilterBar
          placeholder="Search by name or email..."
          searchValue={search}
          onSearchChange={setSearch}
          filterOptions={FILTERS}
          activeFilter={filter}
          onFilterChange={setFilter}
          resultCount={filtered.length}
        />

        {filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/[0.08] rounded-xl bg-card mt-4">
            {applications.length === 0 ? (
              <>
                <Inbox className="w-8 h-8 text-white/30 mx-auto mb-2" />
                <p className="text-white/50 font-medium">No applications yet</p>
              </>
            ) : (
              <>
                <Search className="w-8 h-8 text-white/30 mx-auto mb-2" />
                <p className="text-white/50 font-medium">No matching applications</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {filtered.map((app) => <ApplicationRow key={app.id} application={app} />)}
          </div>
        )}
      </div>
    </div>
  );
}
