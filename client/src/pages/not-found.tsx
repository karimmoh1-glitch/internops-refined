import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
        <Compass className="w-6 h-6 text-[#6D5EF5]" />
      </div>
      <h1 className="text-6xl font-bold font-heading text-white mb-3" data-testid="text-404-title">404</h1>
      <p className="text-zinc-400 mb-8 max-w-sm">
        This page doesn't exist, or it moved. Let's get you back on track.
      </p>
      <Link href="/">
        <Button className="bg-gradient-to-r from-[#6D5EF5] to-[#5142D6] hover:from-[#8B7FF7] hover:to-[#4335B0] text-white" data-testid="button-go-home">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to InternOps
        </Button>
      </Link>
    </div>
  );
}
