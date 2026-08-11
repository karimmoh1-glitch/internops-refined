import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function LandingNav() {
  return (
    <nav id="top" className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold font-heading text-primary flex items-center gap-2 no-underline hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">
            F
          </div>
          ForgeFlow
        </Link>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#metrics" className="hover:text-primary transition-colors">Results</a>
          <a href="#workflow" className="hover:text-primary transition-colors">How it Works</a>
        </div>

        <div className="flex items-center gap-4">
          <a href="/api/login">
            <Button variant="ghost" className="hidden sm:inline-flex text-slate-600" data-testid="button-login">Log in</Button>
          </a>
          <a href="#cta">
            <Button className="bg-primary hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-500/20" data-testid="button-request-access">
              Request Access
            </Button>
          </a>
        </div>
      </div>
    </nav>
  );
}
