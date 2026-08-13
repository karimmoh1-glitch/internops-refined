import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#6366F1"];
const STATUS_COLORS: Record<string, string> = {
  assigned: "#9CA3AF",
  planning: "#F59E0B",
  submitted: "#3B82F6",
  approved: "#10B981",
  active: "#059669",
};
const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "#9CA3AF",
  in_progress: "#3B82F6",
  in_review: "#F59E0B",
  completed: "#10B981",
  blocked: "#EF4444",
};
const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  completed: "Completed",
  blocked: "Blocked",
};

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function ChartCard({ title, description, children }: ChartCardProps) {
  return (
    <div className="bg-[#141110] border border-white/[0.08] rounded-xl shadow-sm p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
      </div>
      <div className="h-52">
        {children}
      </div>
    </div>
  );
}

// Admin Charts

export function ProjectStatusPieChart({ data }: { data: { status: string; count: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <ChartCard title="Project Status Distribution">
        <div className="h-full flex items-center justify-center text-sm text-white/40">No project data</div>
      </ChartCard>
    );
  }

  const chartData = data.map((d) => ({
    name: d.status.charAt(0).toUpperCase() + d.status.slice(1),
    value: d.count,
    fill: STATUS_COLORS[d.status] || COLORS[0],
  }));

  return (
    <ChartCard title="Project Status Distribution" description="Current status of all projects">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
          >
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CompletionRateBarChart({ data }: { data: { internName: string; completionRate: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <ChartCard title="Intern Completion Rates">
        <div className="h-full flex items-center justify-center text-sm text-white/40">No completion data</div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Intern Completion Rates" description="Percentage of subtasks completed per intern">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 60, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} />
          <YAxis type="category" dataKey="internName" width={55} fontSize={11} />
          <Tooltip formatter={(v: number) => [`${v}%`, "Completion"]} />
          <Bar dataKey="completionRate" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function WeeklyActivityLineChart({ data }: { data: { week: string; logs: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <ChartCard title="Weekly Log Activity">
        <div className="h-full flex items-center justify-center text-sm text-white/40">No activity data</div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Weekly Log Activity" description="Number of log entries per week">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="week" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Line type="monotone" dataKey="logs" stroke="#6366F1" strokeWidth={2} dot={{ fill: "#6366F1", r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function HoursComparisonChart({ data }: { data: { internName: string; planned: number; logged: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <ChartCard title="Hours: Planned vs Logged">
        <div className="h-full flex items-center justify-center text-sm text-white/40">No hours data</div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Hours: Planned vs Logged" description="Compare planned hours with logged activity">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 40, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="internName" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="planned" fill="#93C5FD" name="Planned" radius={[4, 4, 0, 0]} barSize={16} />
          <Bar dataKey="logged" fill="#3B82F6" name="Logged" radius={[4, 4, 0, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TaskStatusPieChart({ data }: { data: { status: string; count: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <ChartCard title="Task Status Breakdown">
        <div className="h-full flex items-center justify-center text-sm text-white/40">No tasks yet</div>
      </ChartCard>
    );
  }

  const chartData = data.map((d) => ({
    name: TASK_STATUS_LABELS[d.status] || d.status,
    value: d.count,
    fill: TASK_STATUS_COLORS[d.status] || COLORS[0],
  }));

  return (
    <ChartCard title="Task Status Breakdown" description="Current status of all tasks">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
          >
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TaskCompletionByInternChart({ data }: { data: { internName: string; completed: number; total: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <ChartCard title="Task Completion by Intern">
        <div className="h-full flex items-center justify-center text-sm text-white/40">No tasks assigned yet</div>
      </ChartCard>
    );
  }

  const chartData = data.map((d) => ({ ...d, remaining: d.total - d.completed }));

  return (
    <ChartCard title="Task Completion by Intern" description="Completed vs. total assigned tasks">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="internName" fontSize={11} />
          <YAxis fontSize={11} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="completed" stackId="tasks" fill="#10B981" name="Completed" radius={[0, 0, 0, 0]} barSize={24} />
          <Bar dataKey="remaining" stackId="tasks" fill="#E5E7EB" name="Remaining" radius={[4, 4, 0, 0]} barSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// Intern Charts

export function PersonalProgressLineChart({ data }: { data: { week: number; completed: number; total: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <ChartCard title="My Progress">
        <div className="h-full flex items-center justify-center text-sm text-white/40">No progress data yet</div>
      </ChartCard>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    weekLabel: `W${d.week}`,
    completionPct: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
  }));

  return (
    <ChartCard title="My Progress" description="Subtask completion per week">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="weekLabel" fontSize={11} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} />
          <Tooltip formatter={(v: number) => [`${v}%`, "Completion"]} />
          <Line type="monotone" dataKey="completionPct" stroke="#10B981" strokeWidth={2} dot={{ fill: "#10B981", r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function WeeklyHoursBarChart({ data }: { data: { week: number; logs: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <ChartCard title="Weekly Activity">
        <div className="h-full flex items-center justify-center text-sm text-white/40">No activity data yet</div>
      </ChartCard>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    weekLabel: `W${d.week}`,
  }));

  return (
    <ChartCard title="Weekly Activity" description="Log entries per week">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="weekLabel" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Bar dataKey="logs" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
