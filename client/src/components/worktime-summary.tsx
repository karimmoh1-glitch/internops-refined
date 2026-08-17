import { useQuery } from "@tanstack/react-query";
import { Clock, ListChecks, Activity } from "lucide-react";
import { formatDuration } from "@/components/shift-control";

interface Bucket {
  totalSeconds: number;
  sessionCount: number;
  avgSessionSeconds: number;
  tasksCompleted: number;
}

interface WorktimeSummaryData {
  today: Bucket;
  week: Bucket;
  overall: Bucket;
}

function BucketCard({ label, bucket }: { label: string; bucket: Bucket }) {
  return (
    <div className="bg-card border border-white/[0.08] rounded-xl p-4">
      <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-baseline gap-1.5 mb-3">
        <Clock className="w-4 h-4 text-[#6D5EF5] mb-0.5" />
        <span className="text-2xl font-bold text-white tabular-nums">{formatDuration(bucket.totalSeconds)}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-white/50">
        <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{bucket.sessionCount} session{bucket.sessionCount !== 1 ? "s" : ""}</span>
        <span className="flex items-center gap-1"><ListChecks className="w-3 h-3" />{bucket.tasksCompleted} completed</span>
      </div>
    </div>
  );
}

export default function WorktimeSummary() {
  const { data, isLoading } = useQuery<WorktimeSummaryData>({
    queryKey: ["/api/work-sessions/summary"],
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[104px] bg-card border border-white/[0.08] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6" data-testid="worktime-summary">
      <BucketCard label="Today" bucket={data.today} />
      <BucketCard label="This Week" bucket={data.week} />
      <BucketCard label="Overall" bucket={data.overall} />
    </div>
  );
}
