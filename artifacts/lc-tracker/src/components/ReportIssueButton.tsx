import { MessageSquareWarning } from "lucide-react";
import { usePostHog } from "@posthog/react";
import { Button } from "@/components/ui/button";

export function ReportIssueButton() {
  const posthog = usePostHog();

  const handleClick = () => {
    posthog?.capture("report_issue_clicked", {
      url: window.location.href,
    });
    window.open(
      "https://github.com/i-harshit-sharma/LCTracker/issues/new",
      "_blank",
    );
  };

  return (
    <div className="fixed bottom-4 right-4 z-100">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg hover:bg-muted group transition-all duration-300"
      >
        <MessageSquareWarning className="h-4 w-4 mr-2 text-primary group-hover:scale-110 transition-transform" />
        <span className="hidden sm:inline">Report an Issue</span>
        <span className="sm:hidden">Report</span>
      </Button>
    </div>
  );
}
