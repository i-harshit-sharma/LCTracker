import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Bell, BellOff, ExternalLink, CheckCheck, Mail, Clock, Smartphone, SmartphoneNfc } from "lucide-react";
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
  useGetPreferences,
  useUpdatePreferences,
  getGetPreferencesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Format hour (0-23) + minute (0-59) as "8:30 AM UTC" */
function formatUtcTime(hour: number, minute: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m} ${period} UTC`;
}

/** 5-minute steps: 0, 5, 10 … 55 */
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => i * 5);
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ─── Push helpers ─────────────────────────────────────────────────────────────

/** Convert a base64url string to a Uint8Array (needed for applicationServerKey) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const API_BASE = import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? "http://localhost:3000"
    : "");

async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/push/vapid-public-key`);
  if (!res.ok) throw new Error("Failed to fetch VAPID key");
  const data = await res.json();
  return data.publicKey as string;
}

async function apiSubscribe(token: string, sub: PushSubscriptionJSON): Promise<void> {
  const keys = sub.keys as { p256dh: string; auth: string };
  await fetch(`${API_BASE}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
  });
}

async function apiUnsubscribe(token: string, endpoint: string): Promise<void> {
  await fetch(`${API_BASE}/api/push/subscribe`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint }),
  });
}

async function apiSendMockNotification(token: string): Promise<void> {
  await fetch(`${API_BASE}/api/push/mock`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── PushNotificationSettingsCard ────────────────────────────────────────────

function PushNotificationSettingsCard() {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    () => {
      if (typeof Notification === "undefined") return "unsupported";
      return Notification.permission;
    },
  );
  const [loading, setLoading] = useState(false);
  const [currentSub, setCurrentSub] = useState<PushSubscription | null>(null);

  // Check if we already have an active subscription on mount
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setCurrentSub(sub))
      .catch(() => { });
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    // Clerk exposes the session token via window.Clerk
    try {
      const clerk = (window as any).Clerk;
      if (clerk?.session) return await clerk.session.getToken();
    } catch { }
    return null;
  }, []);

  const handleEnable = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      toast({ title: "Push notifications not supported in this browser", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        toast({
          title: "Permission denied",
          description: "Enable notifications in your browser settings to receive push alerts.",
          variant: "destructive",
        });
        return;
      }

      // Subscribe via the Push Manager
      const [vapidKey, reg] = await Promise.all([
        fetchVapidPublicKey(),
        navigator.serviceWorker.ready,
      ]);

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as any,
      });

      setCurrentSub(sub);

      // Persist to API
      const token = await getToken();
      if (token) {
        await apiSubscribe(token, sub.toJSON());
        // Send a mock notification to verify setup
        await apiSendMockNotification(token);
        toast({ title: "🔔 Push notifications enabled!" });
      } else {
        toast({
          title: "Subscribed locally",
          description: "Could not save to server — please reload and try again.",
        });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to enable push notifications", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!currentSub) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (token) await apiUnsubscribe(token, currentSub.endpoint);
      await currentSub.unsubscribe();
      setCurrentSub(null);
      toast({ title: "Push notifications disabled" });
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to disable notifications", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isSubscribed = !!currentSub && permission === "granted";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <SmartphoneNfc className="h-4 w-4 text-primary" />
          Browser Push Notifications
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {permission === "unsupported" ? (
          <p className="text-sm text-muted-foreground">
            Push notifications are not supported in this browser.
          </p>
        ) : permission === "denied" ? (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 space-y-1">
            <p className="text-sm font-medium text-destructive">Notifications blocked</p>
            <p className="text-xs text-muted-foreground">
              You've blocked notifications for this site. To re-enable them, click the lock icon
              in your browser's address bar and allow notifications, then refresh the page.
            </p>
          </div>
        ) : isSubscribed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 shrink-0" />
              <span className="font-medium">Push notifications active</span>
            </div>
            <p className="text-xs text-muted-foreground">
              You'll receive a notification whenever someone you follow solves a LeetCode problem —
              with a direct link to try it yourself!
            </p>
            <Button
              id="disable-push-notifications"
              variant="outline"
              size="sm"
              onClick={handleDisable}
              disabled={loading}
              className="text-muted-foreground hover:text-destructive hover:border-destructive"
            >
              <Smartphone className="h-3.5 w-3.5 mr-1.5" />
              {loading ? "Disabling…" : "Disable push notifications"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Get notified instantly</p>
              <p className="text-xs text-muted-foreground">
                Allow push notifications and we'll alert you the moment a followed user solves a
                new problem — so you can try it too!
              </p>
            </div>
            <Button
              id="enable-push-notifications"
              size="sm"
              onClick={handleEnable}
              disabled={loading}
              className="bg-primary hover:bg-primary/90"
            >
              <Bell className="h-3.5 w-3.5 mr-1.5" />
              {loading ? "Requesting permission…" : "Enable push notifications"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Email Settings card ──────────────────────────────────────────────────────

function EmailSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading: prefsLoading } = useGetPreferences();
  const updatePrefs = useUpdatePreferences();

  // Local state — kept in sync with server data
  const [hour, setHour] = useState<number>(20);
  const [minute, setMinute] = useState<number>(0);
  const [enabled, setEnabled] = useState<boolean>(true);

  // Sync from server whenever data arrives
  useEffect(() => {
    if (prefs) {
      setHour(prefs.digestHour);
      // Snap to nearest 5-minute step in case the DB has a non-step value
      setMinute(Math.round(prefs.digestMinute / 5) * 5 % 60);
      setEnabled(prefs.emailEnabled);
    }
  }, [prefs]);

  const save = (patch: { digestHour?: number; digestMinute?: number; emailEnabled?: boolean }) => {
    updatePrefs.mutate(
      { data: patch },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetPreferencesQueryKey(), updated);
          toast({ title: "Email preferences saved" });
        },
        onError: () => {
          toast({ title: "Failed to save preferences", variant: "destructive" });
        },
      },
    );
  };

  if (prefsLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Email Digest Settings
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Enable / disable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Daily digest email</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receive a summary of what your followed users solved each day
            </p>
          </div>
          <button
            id="toggle-email-digest"
            role="switch"
            aria-checked={enabled}
            onClick={() => {
              const next = !enabled;
              setEnabled(next);
              save({ emailEnabled: next });
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer ${enabled ? "bg-primary" : "bg-input"
              }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${enabled ? "translate-x-5" : "translate-x-0"
                }`}
            />
          </button>
        </div>

        {/* Time picker — only shown when enabled */}
        {enabled && (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Send time (UTC)
            </label>

            <div className="flex items-center gap-2">
              {/* Hour selector */}
              <select
                id="digest-hour-select"
                value={hour}
                onChange={(e) => {
                  const h = Number(e.target.value);
                  setHour(h);
                  save({ digestHour: h });
                }}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-28"
              >
                {HOURS.map((h) => {
                  const period = h < 12 ? "AM" : "PM";
                  const display = h % 12 === 0 ? 12 : h % 12;
                  return (
                    <option key={h} value={h}>
                      {display}:00 {period}
                    </option>
                  );
                })}
              </select>

              <span className="text-muted-foreground text-sm">:</span>

              {/* Minute selector (5-min steps) */}
              <select
                id="digest-minute-select"
                value={minute}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setMinute(m);
                  save({ digestMinute: m });
                }}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-20"
              >
                {MINUTE_STEPS.map((m) => (
                  <option key={m} value={m}>
                    {m.toString().padStart(2, "0")}
                  </option>
                ))}
              </select>

              <span className="text-xs text-muted-foreground">UTC</span>
            </div>

            {/* Live preview */}
            <p className="text-xs text-muted-foreground">
              Your digest will be sent at{" "}
              <span className="font-medium text-foreground">
                {formatUtcTime(hour, minute)}
              </span>{" "}
              every day.
            </p>
          </div>
        )}

        {updatePrefs.isPending && (
          <p className="text-xs text-muted-foreground animate-pulse">Saving…</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
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

        {/* ── Notification list ── */}
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
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-5 py-4 flex gap-3 items-start transition-colors hover:bg-muted/30 ${!notif.read ? "bg-primary/5 border-l-2 border-l-primary" : ""
                      }`}
                    data-testid={`notification-item-${notif.id}`}
                  >
                    <div
                      className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${notif.read
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

        {/* ── Push notification settings ── */}
        <PushNotificationSettingsCard />

        {/* ── Email settings ── */}
        <EmailSettingsCard />
      </main>
    </div>
  );
}
