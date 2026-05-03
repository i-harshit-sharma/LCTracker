import { useUser } from "@clerk/react";
import { usePostHog } from "@posthog/react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export function PostHogIdentifier() {
  const { user } = useUser();
  const posthog = usePostHog();
  const [location] = useLocation();

  // Track page views
  useEffect(() => {
    if (posthog && location) {
      posthog.capture("$pageview", {
        $current_url: window.location.href,
      });
    }
  }, [location, posthog]);

  // Identify user
  useEffect(() => {
    if (user && posthog) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        username: user.username,
        fullName: user.fullName,
      });
    } else if (!user && posthog) {
      posthog.reset();
    }
  }, [user, posthog]);

  return null;
}
