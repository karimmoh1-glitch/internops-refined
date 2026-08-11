import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

export default function LandingCTA() {
  const [email, setEmail] = useState("");

  const signupMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/pilot-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to sign up");
      }
      return res.json();
    },
    onSuccess: () => {
      setEmail("");
    },
  });

  return (
    <section id="cta" className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="bg-primary rounded-3xl p-8 md:p-16 text-center md:text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />

          <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold font-heading text-white mb-6">
                Ready to transform your internship program?
              </h2>
              <p className="text-blue-100 text-lg mb-8 leading-relaxed max-w-lg">
                Join our pilot program today and get early access to AI-powered management tools.
              </p>
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-blue-100 text-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Limited pilot spots available
                </div>
                <div className="flex items-center gap-2 text-blue-100 text-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Free onboarding support
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20">
              {signupMutation.isSuccess ? (
                <div className="flex flex-col items-center gap-4 py-6 text-white">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                  <p className="text-lg font-semibold">You're on the list!</p>
                  <p className="text-blue-200 text-sm text-center">We'll reach out soon with pilot access details.</p>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); signupMutation.mutate(email); }}>
                  <div>
                    <label className="block text-sm font-medium text-blue-100 mb-1">Work Email</label>
                    <Input
                      data-testid="input-email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-white/90 border-transparent h-12 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                  {signupMutation.isError && (
                    <p data-testid="text-error" className="text-red-200 text-sm">{signupMutation.error.message}</p>
                  )}
                  <Button
                    data-testid="button-signup"
                    type="submit"
                    disabled={signupMutation.isPending}
                    className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg shadow-lg shadow-emerald-900/20"
                  >
                    {signupMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>Request Access <ArrowRight className="ml-2 w-5 h-5" /></>
                    )}
                  </Button>
                  <p className="text-xs text-blue-200 text-center mt-4">
                    No credit card required for pilot access.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
