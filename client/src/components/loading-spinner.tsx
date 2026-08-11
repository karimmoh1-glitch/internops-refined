import { Loader2 } from "lucide-react";

export default function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-slate-500 text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}

export function InlineSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        <p className="text-slate-400 text-sm">{message}</p>
      </div>
    </div>
  );
}
