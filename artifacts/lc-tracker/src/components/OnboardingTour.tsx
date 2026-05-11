import { useEffect, useState } from "react";
import {
  Joyride,
  Step,
  ACTIONS,
  EVENTS,
  STATUS,
  type EventData as CallBackProps,
} from "react-joyride";
import { useLocation } from "wouter";
import {
  useGetPreferences,
  useUpdatePreferences,
} from "@workspace/api-client-react";
import { useFeatureFlagEnabled } from "posthog-js/react";

export function OnboardingTour() {
  const { data: prefs, isLoading } = useGetPreferences();
  const updatePrefs = useUpdatePreferences();
  const [location, setLocation] = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const isTourEnabled = useFeatureFlagEnabled("tour");

  useEffect(() => {
    const preferences = prefs as any;
    if (
      !isLoading &&
      preferences &&
      !preferences.onboardingCompleted &&
      isTourEnabled
    ) {
      setRun(true);
    }
  }, [isLoading, prefs, isTourEnabled]);

  const steps: Step[] = [];

  if (!prefs?.isVerified) {
    steps.push({
      target: "body",
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">Welcome to LCTracker! 🚀</h3>
          <p>
            Let's get your account set up so you can start tracking your
            progress and following friends.
          </p>
        </div>
      ),
      placement: "center",
      skipBeacon: true,
    });

    if (!prefs?.leetcodeUsername) {
      steps.push({
        target: "#tour-username-input",
        content: "Enter your LeetCode username here to get started.",
        placement: "bottom",
      });
      steps.push({
        target: "#tour-save-username",
        content: "Click save to generate your unique verification token.",
        placement: "bottom",
      });
    } else {
      steps.push({
        target: "#tour-verification-token",
        content:
          "Copy this token and paste it into your LeetCode profile 'About' section.",
        placement: "bottom",
      });
      steps.push({
        target: "#tour-verify-button",
        content:
          "Once you've updated your LeetCode profile, click here to verify ownership.",
        placement: "top",
      });
    }
  } else {
    // User is verified, show the rest of the tour
    if (location === "/dashboard") {
      steps.push({
        target: "#tour-nav-follows",
        content:
          "Now that you're verified, go to the 'Following' page to add your friends!",
        placement: "bottom",
      });
    } else if (location === "/follows") {
      steps.push({
        target: "#tour-follow-form",
        content:
          "Simply enter your friend's LeetCode username here to start tracking their progress alongside yours.",
        placement: "bottom",
      });
      steps.push({
        target: "body",
        content: (
          <div className="text-left">
            <h3 className="font-bold text-lg mb-2">You're all set! 🎉</h3>
            <p>
              You've learned how to connect your account and follow friends.
              Enjoy tracking!
            </p>
          </div>
        ),
        placement: "center",
      });
    }
  }

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, action, index } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRun(false);
      // Only mark as completed if they finished the last step on the follows page
      if (status === STATUS.FINISHED && location === "/follows") {
        updatePrefs.mutate({ data: { onboardingCompleted: true } as any });
      } else if (status === STATUS.SKIPPED) {
        updatePrefs.mutate({ data: { onboardingCompleted: true } as any });
      }
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      if (action === ACTIONS.NEXT) {
        setStepIndex(index + 1);
      } else if (action === ACTIONS.PREV) {
        setStepIndex(index - 1);
      }
    }
  };

  if (!run || steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      onEvent={handleJoyrideCallback}
      options={{
        primaryColor: "hsl(24, 95%, 53%)",
        textColor: "hsl(210, 40%, 95%)",
        backgroundColor: "hsl(222, 47%, 12%)",
        arrowColor: "hsl(222, 47%, 12%)",
        zIndex: 1000,
        showProgress: true,
        buttons: ["back", "close", "primary", "skip"],
      }}
      styles={{
        tooltip: {
          borderRadius: "12px",
          padding: "20px",
          border: "1px solid hsl(217, 33%, 17%)",
          boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.5)",
        },
        buttonPrimary: {
          borderRadius: "6px",
          fontWeight: 600,
        },
        buttonBack: {
          marginRight: 10,
          color: "hsl(215, 20%, 65%)",
        },
        buttonSkip: {
          color: "hsl(215, 20%, 65%)",
        },
      }}
    />
  );
}
