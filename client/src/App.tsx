import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-role";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import AcceptInvite from "@/pages/accept-invite";
import Apply from "@/pages/apply";
import PublicInternProfile from "@/pages/public-intern-profile";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Contact from "@/pages/contact";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";
import InternDashboard from "@/pages/intern-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import ChatPage from "@/pages/chat";
import TasksPage from "@/pages/tasks";
import InternProfile from "@/pages/intern-profile";
import SettingsPage from "@/pages/settings";
import Alumni from "@/pages/alumni";
import AlumniCertificate from "@/pages/alumni-certificate";
import Worktime from "@/pages/worktime";
import ApplicationsHistory from "@/pages/applications";
import DownloadPage from "@/pages/download";
import AppShell from "@/components/app-shell";
import { useEffect } from "react";

function DashboardForRole({ user }: { user: any }) {
  if (user.role === "admin") return <AdminDashboard user={user} />;
  return <InternDashboard user={user} />;
}

function AuthenticatedView({ user, signOut }: { user: any; signOut: () => void }) {
  return (
    <AppShell user={user} onSignOut={signOut}>
      <DashboardForRole user={user} />
    </AppShell>
  );
}

function AuthenticatedChat({ user, signOut }: { user: any; signOut: () => void }) {
  return (
    <AppShell user={user} onSignOut={signOut}>
      <ChatPage user={user} />
    </AppShell>
  );
}

function AuthenticatedTasks({ user, signOut }: { user: any; signOut: () => void }) {
  return (
    <AppShell user={user} onSignOut={signOut}>
      <TasksPage user={user} />
    </AppShell>
  );
}

function AuthenticatedInternProfile({ user, signOut, internId }: { user: any; signOut: () => void; internId: string }) {
  return (
    <AppShell user={user} onSignOut={signOut}>
      <InternProfile internId={internId} />
    </AppShell>
  );
}

function AuthenticatedAlumni({ user, signOut }: { user: any; signOut: () => void }) {
  return (
    <AppShell user={user} onSignOut={signOut}>
      <Alumni />
    </AppShell>
  );
}

function AuthenticatedAlumniCertificate({ user, signOut, internId }: { user: any; signOut: () => void; internId: string }) {
  return (
    <AppShell user={user} onSignOut={signOut}>
      <AlumniCertificate internId={internId} />
    </AppShell>
  );
}

function AuthenticatedWorktime({ user, signOut }: { user: any; signOut: () => void }) {
  return (
    <AppShell user={user} onSignOut={signOut}>
      <Worktime />
    </AppShell>
  );
}

function AuthenticatedApplications({ user, signOut }: { user: any; signOut: () => void }) {
  return (
    <AppShell user={user} onSignOut={signOut}>
      <ApplicationsHistory />
    </AppShell>
  );
}

function AuthenticatedSettings({ user, signOut }: { user: any; signOut: () => void }) {
  return (
    <AppShell user={user} onSignOut={signOut}>
      <SettingsPage user={user} />
    </AppShell>
  );
}

function AppContent() {
  const { user, login, signup, acceptInvite, signOut } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (user && (location === "/login" || location === "/manager-login" || location === "/intern-login" || location === "/signup" || location === "/forgot-password")) {
      setLocation("/");
    }
  }, [user, location, setLocation]);

  return (
    <Switch>
      <Route path="/">
        {user ? (
          <AuthenticatedView user={user} signOut={signOut} />
        ) : (
          <Landing />
        )}
      </Route>
      <Route path="/login">
        {user ? (
          <AuthenticatedView user={user} signOut={signOut} />
        ) : (
          <Login onLogin={login} />
        )}
      </Route>
      <Route path="/manager-login">
        <Redirect to="/login" />
      </Route>
      <Route path="/intern-login">
        <Redirect to="/login" />
      </Route>
      <Route path="/signup">
        {user ? (
          <AuthenticatedView user={user} signOut={signOut} />
        ) : (
          <Signup onSignup={signup} />
        )}
      </Route>
      <Route path="/invite/:token">
        {(params) =>
          user ? (
            <AuthenticatedView user={user} signOut={signOut} />
          ) : (
            <AcceptInvite token={params.token} onAccept={acceptInvite} />
          )
        }
      </Route>
      <Route path="/apply/:slug">
        {(params) =>
          user ? (
            <AuthenticatedView user={user} signOut={signOut} />
          ) : (
            <Apply slug={params.slug} />
          )
        }
      </Route>
      <Route path="/forgot-password">
        {user ? (
          <AuthenticatedView user={user} signOut={signOut} />
        ) : (
          <ForgotPassword />
        )}
      </Route>
      <Route path="/chat">
        {user ? (
          <AuthenticatedChat user={user} signOut={signOut} />
        ) : (
          <Landing />
        )}
      </Route>
      <Route path="/tasks">
        {user ? (
          <AuthenticatedTasks user={user} signOut={signOut} />
        ) : (
          <Landing />
        )}
      </Route>
      <Route path="/interns/:id">
        {(params) =>
          user && user.role === "admin" ? (
            <AuthenticatedInternProfile user={user} signOut={signOut} internId={params.id} />
          ) : user ? (
            <AuthenticatedView user={user} signOut={signOut} />
          ) : (
            <Landing />
          )
        }
      </Route>
      <Route path="/alumni">
        {user && user.role === "admin" ? (
          <AuthenticatedAlumni user={user} signOut={signOut} />
        ) : user ? (
          <AuthenticatedView user={user} signOut={signOut} />
        ) : (
          <Landing />
        )}
      </Route>
      <Route path="/alumni/:id/certificate">
        {(params) =>
          user && user.role === "admin" ? (
            <AuthenticatedAlumniCertificate user={user} signOut={signOut} internId={params.id} />
          ) : user ? (
            <AuthenticatedView user={user} signOut={signOut} />
          ) : (
            <Landing />
          )
        }
      </Route>
      <Route path="/worktime">
        {user && user.role === "admin" ? (
          <AuthenticatedWorktime user={user} signOut={signOut} />
        ) : user ? (
          <AuthenticatedView user={user} signOut={signOut} />
        ) : (
          <Landing />
        )}
      </Route>
      <Route path="/applications">
        {user && user.role === "admin" ? (
          <AuthenticatedApplications user={user} signOut={signOut} />
        ) : user ? (
          <AuthenticatedView user={user} signOut={signOut} />
        ) : (
          <Landing />
        )}
      </Route>
      <Route path="/settings">
        {user ? (
          <AuthenticatedSettings user={user} signOut={signOut} />
        ) : (
          <Landing />
        )}
      </Route>
      <Route path="/reset-password/:token">
        {(params) => <ResetPassword token={params.token} />}
      </Route>
      <Route path="/verify-email/:token">
        {(params) => <VerifyEmail token={params.token} />}
      </Route>
      <Route path="/i/:slug">
        {(params) => <PublicInternProfile slug={params.slug} />}
      </Route>
      <Route path="/download" component={DownloadPage} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
