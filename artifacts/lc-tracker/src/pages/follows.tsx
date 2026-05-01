import { useState } from "react";
import { Link } from "wouter";
import { UserMinus, UserPlus, ExternalLink, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import {
  useListFollows,
  useCreateFollow,
  useDeleteFollow,
  getListFollowsQueryKey,
  getGetLeaderboardQueryKey,
  getGetActivityStatsQueryKey,
  getListActivityQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const addFollowSchema = z.object({
  leetcodeUsername: z
    .string()
    .min(1, "Username required")
    .max(40, "Username too long")
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid LeetCode username"),
});

type AddFollowForm = z.infer<typeof addFollowSchema>;

export default function FollowsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: follows, isLoading } = useListFollows();
  const createFollow = useCreateFollow();
  const deleteFollow = useDeleteFollow();

  const form = useForm<AddFollowForm>({
    resolver: zodResolver(addFollowSchema),
    defaultValues: { leetcodeUsername: "" },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListFollowsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetActivityStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() });
  };

  const onAdd = (data: AddFollowForm) => {
    createFollow.mutate(
      { data: { leetcodeUsername: data.leetcodeUsername } },
      {
        onSuccess: () => {
          toast({ title: `Now following @${data.leetcodeUsername}` });
          form.reset();
          invalidateAll();
        },
        onError: (err: any) => {
          toast({
            title: "Failed to follow",
            description: err?.data?.error ?? "That username might not exist or be private.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const onUnfollow = (id: number, username: string) => {
    setDeletingId(id);
    deleteFollow.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: `Unfollowed @${username}` });
          invalidateAll();
        },
        onError: () => {
          toast({ title: "Failed to unfollow", variant: "destructive" });
        },
        onSettled: () => setDeletingId(null),
      },
    );
  };

  const filtered = Array.isArray(follows)
    ? follows.filter((f) => f.leetcodeUsername.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold mb-1">Following</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Add any public LeetCode username to follow their progress.
        </p>

        {/* Add follow form */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Follow a LeetCode user
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit(onAdd)}
              className="flex gap-2"
              data-testid="form-add-follow"
            >
              <div className="flex-1">
                <Input
                  {...form.register("leetcodeUsername")}
                  placeholder="Enter LeetCode username"
                  data-testid="input-leetcode-username"
                  className="font-mono"
                />
                {form.formState.errors.leetcodeUsername && (
                  <p className="text-destructive text-xs mt-1">
                    {form.formState.errors.leetcodeUsername.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={createFollow.isPending}
                data-testid="button-follow-submit"
                className="glow-orange shrink-0"
              >
                {createFollow.isPending ? "Adding..." : "Follow"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Search follows */}
        {follows && follows.length > 4 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search followed users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-follows"
            />
          </div>
        )}

        {/* Follows list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Following{follows ? ` (${follows.length})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex gap-3 items-center">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : !Array.isArray(follows) || follows.length === 0 ? (
              <div className="px-5 py-12 text-center text-muted-foreground text-sm">
                You're not following anyone yet. Add a LeetCode username above to get started.
              </div>
            ) : !filtered?.length ? (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                No results for "{search}"
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((follow) => (
                  <div
                    key={follow.id}
                    className="px-5 py-4 flex gap-3 items-center hover:bg-muted/30 transition-colors"
                    data-testid={`follow-row-${follow.id}`}
                  >
                    {follow.avatarUrl ? (
                      <img
                        src={follow.avatarUrl}
                        alt={follow.leetcodeUsername}
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
                      />
                    ) : (
                      <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {follow.leetcodeUsername[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/profiles/${follow.leetcodeUsername}`}
                          className="font-semibold text-sm hover:text-primary transition-colors"
                        >
                          {follow.displayName ?? follow.leetcodeUsername}
                        </Link>
                        <a
                          href={`https://leetcode.com/${follow.leetcodeUsername}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                          data-testid={`link-lc-profile-${follow.id}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        @{follow.leetcodeUsername}
                        {follow.totalSolved != null && (
                          <span className="ml-2 text-primary font-sans font-medium">
                            {follow.totalSolved} solved
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUnfollow(follow.id, follow.leetcodeUsername)}
                      disabled={deletingId === follow.id}
                      data-testid={`button-unfollow-${follow.id}`}
                      className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                    >
                      <UserMinus className="h-3.5 w-3.5 mr-1" />
                      {deletingId === follow.id ? "..." : "Unfollow"}
                    </Button>
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
