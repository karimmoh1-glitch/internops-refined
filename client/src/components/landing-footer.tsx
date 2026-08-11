import { Link } from "wouter";
import { Mail } from "lucide-react";

export default function LandingFooter() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 pt-16 pb-8">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="text-xl font-bold font-heading text-primary flex items-center gap-2 mb-4 no-underline hover:opacity-80 transition-opacity" data-testid="link-footer-home">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">
                F
              </div>
              ForgeFlow
            </Link>
            <p className="text-slate-500 max-w-sm mb-6">
              Empowering the next generation of talent with AI-driven insights and effortless management tools.
            </p>
            <a href="mailto:hello@forgeflow.app" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors" data-testid="link-contact-email">
              <Mail className="w-4 h-4" />
              hello@forgeflow.app
            </a>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><a href="#features" className="hover:text-primary" data-testid="link-footer-features">Features</a></li>
              <li><a href="#metrics" className="hover:text-primary" data-testid="link-footer-results">Results</a></li>
              <li><a href="#workflow" className="hover:text-primary" data-testid="link-footer-workflow">How it Works</a></li>
              <li><a href="#cta" className="hover:text-primary" data-testid="link-footer-access">Request Access</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 mb-4">Account</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><a href="/api/login" className="hover:text-primary" data-testid="link-footer-login">Log In</a></li>
              <li><a href="#cta" className="hover:text-primary" data-testid="link-footer-signup">Sign Up for Pilot</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
          <p>&copy; 2026 ForgeFlow Inc. All rights reserved.</p>
          <a href="#top" className="mt-4 md:mt-0 text-primary hover:underline flex items-center gap-1" data-testid="link-back-to-top">
            Back to top
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-up"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
