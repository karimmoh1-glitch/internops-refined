import { Monitor, Sun, Moon, Check } from "lucide-react";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Group, SectionHeader } from "./primitives";

const OPTIONS: { value: ThemePreference; label: string; description: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", description: "Follows your device setting.", icon: Monitor },
  { value: "light", label: "Light", description: "Warm paper, dark ink.", icon: Sun },
  { value: "dark", label: "Dark", description: "Near-black, low glare.", icon: Moon },
];

export function AppearanceSection() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div className="space-y-5">
      <SectionHeader title="Appearance" description="Saved on this device. Other devices keep their own choice." />
      <Group title="Theme" footer={preference === "system" ? `Your device currently prefers ${resolved}.` : undefined}>
        <div className="grid gap-2 p-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
          {OPTIONS.map((o) => {
            const on = preference === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPreference(o.value)}
                className={cn(
                  "group relative flex items-start gap-3 rounded-lg border p-3 text-left transition-colors sm:flex-col sm:gap-2.5",
                  on ? "border-accent bg-accent-soft/50" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2",
                )}
              >
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", on ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-3 group-hover:text-ink-2")}>
                  <o.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-ink">{o.label}</span>
                  <span className="block text-[12px] text-ink-3">{o.description}</span>
                </span>
                {on && <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-ink"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
      </Group>
    </div>
  );
}
