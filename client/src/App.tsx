import { lazy, Suspense, type ComponentType } from "react";
import { Switch, Route, Redirect, useLocation, useSearch } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "@/components/shell/AppShell";
import { Skeleton } from "@/components/kit";

// Public
const Landing = lazy(() => import("@/pages/public/landing"));
const Login = lazy(() => import("@/pages/public/login"));
const Signup = lazy(() => import("@/pages/public/signup"));
const AcceptInvite = lazy(() => import("@/pages/public/accept-invite"));
const Apply = lazy(() => import("@/pages/public/apply"));
const ForgotPassword = lazy(() => import("@/pages/public/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/public/reset-password"));
const VerifyEmail = lazy(() => import("@/pages/public/verify-email"));
const PublicProfile = lazy(() => import("@/pages/public/public-profile"));
const Download = lazy(() => import("@/pages/public/download"));
const Privacy = lazy(() => import("@/pages/public/privacy"));
const Terms = lazy(() => import("@/pages/public/terms"));
const Contact = lazy(() => import("@/pages/public/contact"));
const NotFound = lazy(() => import("@/pages/public/not-found"));

// App
const Home = lazy(() => import("@/pages/app/home"));
const Tasks = lazy(() => import("@/pages/app/tasks"));
const TaskDetail = lazy(() => import("@/pages/app/task-detail"));
const Projects = lazy(() => import("@/pages/app/projects"));
const ProjectDetail = lazy(() => import("@/pages/app/project-detail"));
const People = lazy(() => import("@/pages/app/people"));
const PersonProfile = lazy(() => import("@/pages/app/person"));
const Work = lazy(() => import("@/pages/app/work"));
const Replay = lazy(() => import("@/pages/app/replay"));
const Signals = lazy(() => import("@/pages/app/signals"));
const Pulse = lazy(() => import("@/pages/app/pulse"));
const Messages = lazy(() => import("@/pages/app/messages"));
const SettingsPage = lazy(() => import("@/pages/app/settings"));
const Certificate = lazy(() => import("@/pages/app/certificate"));

function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6 lg:px-8 pt-8 space-y-4" aria-busy>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-3 md:grid-cols-3 pt-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-64" />
    </div>
  );
}

function Private({ component: C, admin = false, params }: { component: ComponentType<any>; admin?: boolean; params?: Record<string, string | undefined> }) {
  const { user, ready } = useAuth();
  const [location] = useLocation();
  const search = useSearch();
  if (!ready) return <PageFallback />;
  // Keep the query string so deep links like /people?tab=alumni survive a
  // sign-in round trip.
  if (!user) return <Redirect to={`/login?next=${encodeURIComponent(location + (search ? `?${search}` : ""))}`} />;
  if (admin && user.role !== "admin") return <Redirect to="/" />;
  return (
    <AppShell>
      <Suspense fallback={<PageFallback />}><C {...(params ?? {})} /></Suspense>
    </AppShell>
  );
}

function Public({ component: C, params, redirectIfAuthed = false }: { component: ComponentType<any>; params?: Record<string, string | undefined>; redirectIfAuthed?: boolean }) {
  const { user, ready } = useAuth();
  if (redirectIfAuthed && ready && user) return <Redirect to="/" />;
  return <Suspense fallback={<div className="min-h-dvh bg-bg" />}><C {...(params ?? {})} /></Suspense>;
}

function Routes() {
  return (
    <Switch>
      <Route path="/"><RootRoute /></Route>
      <Route path="/login"><Public component={Login} redirectIfAuthed /></Route>
      <Route path="/signup"><Public component={Signup} redirectIfAuthed /></Route>
      <Route path="/manager-login"><Redirect to="/login" /></Route>
      <Route path="/intern-login"><Redirect to="/login" /></Route>
      <Route path="/forgot-password"><Public component={ForgotPassword} redirectIfAuthed /></Route>
      <Route path="/reset-password/:token">{(p) => <Public component={ResetPassword} params={p} />}</Route>
      <Route path="/verify-email/:token">{(p) => <Public component={VerifyEmail} params={p} />}</Route>
      <Route path="/invite/:token">{(p) => <Public component={AcceptInvite} params={p} redirectIfAuthed />}</Route>
      <Route path="/apply/:slug">{(p) => <Public component={Apply} params={p} />}</Route>
      <Route path="/i/:slug">{(p) => <Public component={PublicProfile} params={p} />}</Route>
      <Route path="/download"><Public component={Download} /></Route>
      <Route path="/privacy"><Public component={Privacy} /></Route>
      <Route path="/terms"><Public component={Terms} /></Route>
      <Route path="/contact"><Public component={Contact} /></Route>

      <Route path="/tasks"><Private component={Tasks} /></Route>
      <Route path="/tasks/:id">{(p) => <Private component={TaskDetail} params={p} />}</Route>
      <Route path="/projects"><Private component={Projects} /></Route>
      <Route path="/projects/:id">{(p) => <Private component={ProjectDetail} params={p} />}</Route>
      <Route path="/people"><Private component={People} admin /></Route>
      <Route path="/people/:id">{(p) => <Private component={PersonProfile} params={p} admin />}</Route>
      <Route path="/work"><Private component={Work} /></Route>
      <Route path="/work/replay/:sessionId">{(p) => <Private component={Replay} params={p} />}</Route>
      <Route path="/signals"><Private component={Signals} admin /></Route>
      <Route path="/pulse"><Private component={Pulse} /></Route>
      <Route path="/messages"><Private component={Messages} /></Route>
      <Route path="/messages/:channelId">{(p) => <Private component={Messages} params={p} />}</Route>
      <Route path="/settings"><Private component={SettingsPage} /></Route>
      <Route path="/alumni/:id/certificate">{(p) => <Private component={Certificate} params={p} admin />}</Route>

      {/* Legacy paths */}
      <Route path="/chat"><Redirect to="/messages" /></Route>
      <Route path="/interns/:id">{(p) => <Redirect to={`/people/${p.id}`} />}</Route>
      <Route path="/worktime"><Redirect to="/work" /></Route>
      <Route path="/alumni"><Redirect to="/people?tab=alumni" /></Route>
      <Route path="/applications"><Redirect to="/people?tab=applications" /></Route>

      <Route><Public component={NotFound} /></Route>
    </Switch>
  );
}

function RootRoute() {
  const { user, ready } = useAuth();
  if (!ready) return <PageFallback />;
  if (!user) return <Public component={Landing} />;
  return <Private component={Home} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={300}>
            <Toaster />
            <Routes />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
