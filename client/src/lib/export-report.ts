interface ExportInput {
  companyName: string;
  interns: { id: string; name: string; email: string; deactivatedAt: string | null }[];
  completionRates: { internName: string; completionRate: number }[];
  taskCompletionByIntern: { internName: string; completed: number; total: number }[];
  hoursComparison: { internName: string; planned: number; logged: number }[];
}

function csvEscape(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Matches on first-name only, same simplification the server uses when it
// buckets analytics by intern — good enough for a report, not an identity check.
function firstName(fullName: string): string {
  return fullName.split(" ")[0];
}

export function exportTeamReport({ companyName, interns, completionRates, taskCompletionByIntern, hoursComparison }: ExportInput) {
  const header = ["Name", "Email", "Status", "Completion Rate (%)", "Tasks Completed", "Tasks Total", "Hours Logged", "Hours Planned"];

  const rows = interns.map((intern) => {
    const first = firstName(intern.name);
    const completion = completionRates.find((c) => c.internName === first);
    const tasks = taskCompletionByIntern.find((t) => t.internName === first);
    const hours = hoursComparison.find((h) => h.internName === first);
    return [
      intern.name,
      intern.email,
      intern.deactivatedAt ? "Deactivated" : "Active",
      completion ? completion.completionRate : "",
      tasks ? tasks.completed : 0,
      tasks ? tasks.total : 0,
      hours ? hours.logged : 0,
      hours ? hours.planned : 0,
    ];
  });

  const lines = [header, ...rows].map((row) => row.map(csvEscape).join(","));
  const csv = lines.join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${companyName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-team-report-${dateStamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
