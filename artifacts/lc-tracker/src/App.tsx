import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import {
  Switch,
  Route,
  Redirect,
  useLocation,
  Router as WouterRouter,
} from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import FollowsPage from "@/pages/follows";
import NotificationsPage from "@/pages/notifications";
import ProfilePage from "@/pages/profile";
import CreatePage from "@/pages/create-page";
import VerificationPage from "@/pages/verification-page";
import SkylinePage from "@/pages/skyline";
import { useGetPreferences } from "@workspace/api-client-react";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(24, 95%, 53%)",
    colorForeground: "hsl(210, 40%, 95%)",
    colorMutedForeground: "hsl(215, 20%, 55%)",
    colorDanger: "hsl(0, 63%, 55%)",
    colorBackground: "hsl(222, 47%, 10%)",
    colorInput: "hsl(217, 33%, 17%)",
    colorInputForeground: "hsl(210, 40%, 95%)",
    colorNeutral: "hsl(217, 33%, 45%)",
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-[hsl(222,47%,10%)] border border-[hsl(217,33%,17%)] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    headerTitle: "text-[hsl(210,40%,95%)]",
    headerSubtitle: "text-[hsl(215,20%,55%)]",
    socialButtonsBlockButtonText: "text-[hsl(210,40%,95%)]",
    formFieldLabel: "text-[hsl(210,40%,85%)]",
    footerActionLink: "text-[hsl(24,95%,53%)]",
    footerActionText: "text-[hsl(215,20%,55%)]",
    dividerText: "text-[hsl(215,20%,55%)]",
    identityPreviewText: "text-[hsl(210,40%,95%)]",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const listenerAdded = useRef(false);

  useEffect(() => {
    if (listenerAdded.current) return;
    listenerAdded.current = true;
    const unsub = addListener(({ session }) => {
      if (!session) {
        qc.clear();
      }
    });
    return unsub;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  return (
    <>
      <Show when="signed-in">
        <VerificationGate>
          <Component />
        </VerificationGate>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function VerificationGate({ children }: { children: React.ReactNode }) {
  const { data: prefs, isLoading } = useGetPreferences();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isVerified = prefs?.leetcodeUsername && prefs?.isVerified;

  if (!isVerified) {
    return <VerificationPage />;
  }

  return <>{children}</>;
}

import { PostHogIdentifier } from "@/components/PostHogIdentifier";
import { ReportIssueButton } from "@/components/ReportIssueButton";
import { OnboardingTour } from "@/components/OnboardingTour";

function Router() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <PostHogIdentifier />
      <ReportIssueButton />
      <OnboardingTour />
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route
          path="/sign-in/*?"
          component={() => (
            <div className="min-h-screen flex items-center justify-center bg-background">
              <SignIn routing="path" path={`${basePath}/sign-in`} />
            </div>
          )}
        />
        <Route
          path="/sign-up/*?"
          component={() => (
            <div className="min-h-screen flex items-center justify-center bg-background">
              <SignUp routing="path" path={`${basePath}/sign-up`} />
            </div>
          )}
        />
        <Route
          path="/dashboard"
          component={() => <ProtectedRoute component={DashboardPage} />}
        />
        <Route
          path="/follows"
          component={() => <ProtectedRoute component={FollowsPage} />}
        />
        <Route
          path="/notifications"
          component={() => <ProtectedRoute component={NotificationsPage} />}
        />
        <Route
          path="/profiles/:username"
          component={() => <ProtectedRoute component={ProfilePage} />}
        />
        <Route
          path="/skyline"
          component={() => <ProtectedRoute component={SkylinePage} />}
        />
        <Route
          path="/create"
          component={() => <ProtectedRoute component={CreatePage} />}
        />
        <Route component={NotFound} />
      </Switch>
    </ClerkProvider>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
