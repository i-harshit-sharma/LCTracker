import { useState } from "react";
import {
  useGetPreferences,
  useUpdatePreferences,
  useVerifyLeetcodeUsername,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  UserMinus,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function VerificationPage() {
  const { data: prefs, isLoading, refetch } = useGetPreferences();
  const updatePrefs = useUpdatePreferences();
  const verify = useVerifyLeetcodeUsername();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const handleUpdateUsername = async () => {
    if (!username.trim()) return;
    try {
      await updatePrefs.mutateAsync({
        data: { leetcodeUsername: username.trim() } as any,
      });
      toast({
        title: "Username updated",
        description: "Now please verify your account.",
      });
      refetch();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: err.response?.data?.error || "Could not update username",
      });
    }
  };

  const handleRemoveUsername = async () => {
    try {
      await updatePrefs.mutateAsync({
        data: { leetcodeUsername: null } as any,
      });
      setUsername("");
      toast({
        title: "Username removed",
        description: "You can now enter a new username.",
      });
      refetch();
      setIsAlertOpen(false);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to remove username",
        description: "An error occurred while trying to reset your username.",
      });
    }
  };

  const handleVerify = async () => {
    try {
      await verify.mutateAsync();
      toast({
        title: "Verification successful!",
        description: "Your account has been verified.",
      });
      refetch();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description:
          err.response?.data?.error ||
          "Could not verify account. Please check the token.",
      });
    }
  };

  const copyToken = () => {
    if (prefs?.verificationToken) {
      navigator.clipboard.writeText(prefs.verificationToken);
      toast({
        title: "Copied",
        description: "Verification string copied to clipboard.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Step 1: Add Username
  if (!prefs?.leetcodeUsername) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] p-4">
          <Card className="w-full max-w-md border-border/40 shadow-2xl bg-card/50 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
            <CardHeader>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Welcome to LCTracker
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                To get started, please enter your LeetCode username.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">LeetCode Username</Label>
                <Input
                  id="tour-username-input"
                  placeholder="e.g. bobby_leetcode"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-background/50 h-11"
                />
              </div>
              <Alert
                variant="default"
                className="bg-primary/5 border-primary/20 text-primary-foreground/90"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-primary font-semibold">
                  Public Profile Required
                </AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  Your LeetCode profile must be public so we can verify
                  ownership and track your progress.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter>
              <Button
                id="tour-save-username"
                className="w-full font-semibold shadow-lg shadow-primary/20 h-11"
                onClick={handleUpdateUsername}
                disabled={updatePrefs.isPending || !username.trim()}
              >
                {updatePrefs.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Username
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2: Verify Ownership
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] p-4">
        <Card className="w-full max-w-lg border-border/40 shadow-2xl bg-card/50 backdrop-blur-sm relative">
          {/* Settings / Reset Username Button */}
          <div className="absolute top-4 right-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-muted"
                >
                  <div className="flex flex-col gap-0.5 items-center">
                    <div className="w-1 h-1 rounded-full bg-foreground/50" />
                    <div className="w-1 h-1 rounded-full bg-foreground/50" />
                    <div className="w-1 h-1 rounded-full bg-foreground/50" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setIsAlertOpen(true)}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  Change Username
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset your current verification progress for{" "}
                    <strong>{prefs.leetcodeUsername}</strong>. You will need to
                    enter a new username and verify it again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRemoveUsername}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, change username
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Lock className="w-6 h-6 text-primary" />
              Verify Your Account
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Prove ownership of <strong>{prefs.leetcodeUsername}</strong> by
              adding a verification string to your profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-3 shadow-inner">
                <Label className="text-sm font-medium text-primary uppercase tracking-wider">
                  Verification String
                </Label>
                <div className="flex items-center gap-2">
                  <code
                    id="tour-verification-token"
                    className="flex-1 bg-background/80 px-4 py-3 rounded-lg border font-mono text-sm break-all shadow-sm select-all"
                  >
                    {prefs.verificationToken}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyToken}
                    className="shrink-0 hover:bg-primary/10 border-primary/20"
                  >
                    <Copy className="h-4 w-4 text-primary" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <h4 className="font-semibold flex items-center gap-2 text-foreground">
                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    1
                  </div>
                  How to verify:
                </h4>
                <ul className="space-y-3 pl-7 list-none text-muted-foreground">
                  <li className="relative before:absolute before:left-[-1.25rem] before:top-[0.6rem] before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary/40">
                    Go to your{" "}
                    <a
                      href={`https://leetcode.com/settings/profile`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 font-medium decoration-primary/30 underline-offset-4"
                    >
                      LeetCode Profile <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li className="relative before:absolute before:left-[-1.25rem] before:top-[0.6rem] before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary/40">
                    Edit your <strong>"Readme"</strong> section.
                  </li>
                  <li className="relative before:absolute before:left-[-1.25rem] before:top-[0.6rem] before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary/40">
                    Paste the verification string shown above into your Readme.
                  </li>
                  <li className="relative before:absolute before:left-[-1.25rem] before:top-[0.6rem] before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary/40">
                    Save your profile changes on LeetCode.
                  </li>
                  <li className="relative before:absolute before:left-[-1.25rem] before:top-[0.6rem] before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary/40">
                    Click the <strong>"Verify My Account"</strong> button below.
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              id="tour-verify-button"
              className="w-full text-lg font-bold h-12 shadow-xl shadow-primary/25 transition-all hover:scale-[1.01] active:scale-[0.99] bg-primary hover:bg-primary/90"
              onClick={handleVerify}
              disabled={verify.isPending}
            >
              {verify.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-5 w-5" />
              )}
              Verify My Account
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
