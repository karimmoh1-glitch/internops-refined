import { Link } from "wouter";
import { Download, Shield, Monitor, CheckCircle2, XCircle } from "lucide-react";

const RELEASE_BASE = "https://github.com/karimmoh1-glitch/internops-refined/releases/download/companion-v1.2.0";

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Link href="/" className="text-sm text-white/50 hover:text-white/80">← Back to InternOps</Link>

        <div className="mt-6 mb-10">
          <h1 className="text-3xl font-bold">InternOps Companion</h1>
          <p className="text-white/60 mt-2">
            A small desktop app for interns. Turn on Work Mode for your shift, work normally, and get a
            concise, factual shift report — automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          <a
            href={`${RELEASE_BASE}/InternOps.Companion-1.2.0-arm64.dmg`}
            className="bg-[#6D5EF5] hover:bg-[#5142D6] transition-colors rounded-xl p-5 flex items-center gap-3"
            data-testid="link-download-arm64"
          >
            <Download className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">Download for Mac</p>
              <p className="text-xs text-white/70">Apple Silicon (M1/M2/M3/M4)</p>
            </div>
          </a>
          <a
            href={`${RELEASE_BASE}/InternOps.Companion-1.2.0.dmg`}
            className="bg-card border border-white/[0.08] hover:border-white/20 transition-colors rounded-xl p-5 flex items-center gap-3"
            data-testid="link-download-intel"
          >
            <Download className="w-5 h-5 shrink-0 text-white/60" />
            <div>
              <p className="font-semibold">Download for Mac</p>
              <p className="text-xs text-white/50">Intel</p>
            </div>
          </a>
          <a
            href={`${RELEASE_BASE}/InternOps.Companion-1.2.0-win.zip`}
            className="bg-card border border-white/[0.08] hover:border-white/20 transition-colors rounded-xl p-5 flex items-center gap-3"
            data-testid="link-download-windows"
          >
            <Download className="w-5 h-5 shrink-0 text-white/60" />
            <div>
              <p className="font-semibold">Download for Windows</p>
              <p className="text-xs text-white/50">Windows 10/11 (64-bit)</p>
            </div>
          </a>
        </div>

        <div className="bg-card border border-white/[0.08] rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-[#8B7FF7]" />
            <h2 className="font-semibold">What Work Mode records</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-emerald-400 font-medium mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Records</p>
              <ul className="text-white/60 space-y-1">
                <li>Applications used during your shift</li>
                <li>High-level activity duration</li>
                <li>Your current InternOps task/project</li>
              </ul>
            </div>
            <div>
              <p className="text-red-400 font-medium mb-2 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Never records</p>
              <ul className="text-white/60 space-y-1">
                <li>Passwords or keystrokes</li>
                <li>Microphone or camera</li>
                <li>Private files or messages</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-4">Only active while Work Mode is explicitly on. You can stop it anytime.</p>
        </div>

        <div className="bg-card border border-white/[0.08] rounded-xl p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Monitor className="w-4 h-4 text-white/60" />
              <h2 className="font-semibold">First launch on macOS</h2>
            </div>
            <p className="text-sm text-white/60">
              This build isn't notarized by Apple yet, so macOS will warn that it's from an unidentified developer.
              After downloading: open the .dmg, drag InternOps Companion to Applications, then{" "}
              <strong className="text-white/80">right-click the app and choose "Open"</strong> (or go to{" "}
              <strong className="text-white/80">System Settings → Privacy &amp; Security → Open Anyway</strong>).
              You only need to do this once.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Monitor className="w-4 h-4 text-white/60" />
              <h2 className="font-semibold">First launch on Windows</h2>
            </div>
            <p className="text-sm text-white/60">
              This build isn't signed yet, so Windows SmartScreen may warn that it's an unrecognized app.
              After downloading: unzip the folder, then{" "}
              <strong className="text-white/80">click "More info" → "Run anyway"</strong> to open InternOps
              Companion. You only need to do this once.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
