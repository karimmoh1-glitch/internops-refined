import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function TagInput({
  value, onChange, placeholder = "Add a skill and press Enter...", maxTags = 10, disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const tag = draft.trim();
    setDraft("");
    if (!tag || value.length >= maxTags) return;
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-white/10 bg-transparent px-2 py-1.5 min-h-9">
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1" data-testid={`badge-skill-tag-${tag}`}>
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="rounded-sm hover:bg-white/10 p-0.5"
              aria-label={`Remove ${tag}`}
              data-testid={`button-remove-tag-${tag}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </Badge>
      ))}
      {!disabled && value.length < maxTags && (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-24 h-6 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0"
          data-testid="input-skill-tag"
        />
      )}
    </div>
  );
}
