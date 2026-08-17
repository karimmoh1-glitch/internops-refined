export function StatCardSkeleton() {
  return (
    <div className="rounded-lg p-4 border bg-background border-white/[0.06] animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 bg-white/15 rounded" />
        <div className="w-16 h-3 bg-white/15 rounded" />
      </div>
      <div className="w-12 h-7 bg-white/15 rounded mt-1" />
    </div>
  );
}

export function InternCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm animate-pulse">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="w-32 h-4 bg-white/15 rounded mb-2" />
            <div className="w-48 h-3 bg-white/15 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 h-5 bg-white/15 rounded-full" />
            <div className="w-20 h-1.5 bg-white/15 rounded-full" />
            <div className="w-5 h-5 bg-white/15 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="bg-card border border-white/[0.08] rounded-xl p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 mr-3">
          <div className="w-40 h-4 bg-white/15 rounded mb-2" />
          <div className="w-56 h-3 bg-white/15 rounded" />
        </div>
        <div className="w-16 h-5 bg-white/15 rounded-full" />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="w-full h-1.5 bg-white/15 rounded-full" />
        </div>
        <div className="w-16 h-3 bg-white/15 rounded" />
      </div>
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-4 flex items-center gap-4 animate-pulse">
      <div className="w-10 h-10 bg-white/15 rounded-full shrink-0" />
      <div className="flex-1">
        <div className="w-40 h-4 bg-white/15 rounded mb-2" />
        <div className="w-56 h-3 bg-white/15 rounded" />
      </div>
    </div>
  );
}

export function SimplePageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 animate-pulse">
          <div className="w-40 h-7 bg-white/15 rounded mb-2" />
          <div className="w-56 h-4 bg-white/15 rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <ListRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-6 animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="w-40 h-7 bg-white/15 rounded mb-2" />
              <div className="w-28 h-4 bg-white/15 rounded" />
            </div>
            <div className="flex gap-3">
              <div className="w-28 h-9 bg-white/15 rounded-md" />
              <div className="w-32 h-9 bg-white/15 rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        </div>

        <div>
          <div className="w-36 h-5 bg-white/15 rounded mb-4 animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <InternCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InternDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 animate-pulse">
          <div className="w-32 h-7 bg-white/15 rounded mb-2" />
          <div className="w-24 h-4 bg-white/15 rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="border-b border-white/[0.08] bg-card px-4 py-3 flex items-center gap-4 shrink-0 animate-pulse">
        <div className="w-16 h-4 bg-white/15 rounded" />
        <div className="flex-1">
          <div className="w-48 h-5 bg-white/15 rounded mb-1" />
          <div className="w-20 h-4 bg-white/15 rounded-full" />
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="w-[35%] border-r border-white/[0.08] bg-card p-4 animate-pulse">
          <div className="w-full h-8 bg-white/15 rounded mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-full h-12 bg-white/10 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-4 animate-pulse">
          <div className="bg-card border border-white/[0.08] rounded-xl p-4 mb-4">
            <div className="w-32 h-5 bg-white/15 rounded mb-3" />
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-white/10 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border border-white/[0.08] rounded-xl p-4 h-16" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
