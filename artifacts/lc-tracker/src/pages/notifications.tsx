import { Link } from "wouter";
import { Bell, BellOff, ExternalLink, CheckCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Navbar } from "@/components/Navbar";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { useToast } from "@/hooks/use-toast";
import {
  useListNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export default function NotificationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useListNotifications(
    {},
    { query: { queryKey: getListNotificationsQueryKey({}) } },
  );

  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey({ unreadOnly: true }) });
  };

  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "All notifications marked as read" });
        invalidate();
      },
    });
  };

  const handleMarkOne = (id: number) => {
    markOne.mutate(
      { id },
      { onSuccess: () => invalidate() },
    );
  };

  const unreadCount = Array.isArray(notifications) ? notifications.filter((n) => !n.read).length : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              Notifications
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Activity from people you follow
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAll}
              disabled={markAll.isPending}
              data-testid="button-mark-all-read"
              className="shrink-0"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
              Mark all read
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex gap-3 items-start">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !Array.isArray(notifications) || notifications.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <BellOff className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No notifications yet.</p>
                <p className="text-muted-foreground text-xs mt-1">
                  <Link href="/follows" className="text-primary hover:underline">
                    Follow some users
                  </Link>{" "}
                  to get notified when they solve problems.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-5 py-4 flex gap-3 items-start transition-colors hover:bg-muted/30 ${
                      !notif.read ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    }`}
                    data-testid={`notification-item-${notif.id}`}
                  >
                    <div
                      className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        notif.read
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {notif.leetcodeUsername
                        ? notif.leetcodeUsername[0].toUpperCase()
                        : "!"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.read ? "font-medium" : "text-muted-foreground"}`}>
                        {notif.message}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {notif.difficulty && (
                          <DifficultyBadge difficulty={notif.difficulty} />
                        )}
                        {notif.problemSlug && (
                          <a
                            href={`https://leetcode.com/problems/${notif.problemSlug}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            data-testid={`link-notif-problem-${notif.id}`}
                          >
                            View problem
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {(() => {
                            const date = new Date(notif.solvedAt || notif.createdAt);
                            // Safety: if the date is in the future relative to now, 
                            // treat it as "just now" (avoid "in 2 minutes")
                            const finalDate = date > new Date() ? new Date() : date;
                            return formatDistanceToNow(finalDate, { addSuffix: true });
                          })()}
                        </span>
                      </div>
                    </div>

                    {!notif.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkOne(notif.id)}
                        disabled={markOne.isPending}
                        data-testid={`button-mark-read-${notif.id}`}
                        className="shrink-0 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
