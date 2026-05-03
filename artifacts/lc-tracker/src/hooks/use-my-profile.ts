import { useCallback } from "react";
import { 
  useGetPreferences, 
  useUpdatePreferences, 
  getGetPreferencesQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useMyProfile() {
  const queryClient = useQueryClient();
  const { data: prefs, isLoading } = useGetPreferences();
  const updatePrefs = useUpdatePreferences();

  const myUsername = (prefs as any)?.leetcodeUsername || null;

  const setMyUsername = useCallback((username: string | null) => {
    const newUsername = username ? username.trim().toLowerCase() : null;
    
    // Optimistically update the cache to show instant UI change
    queryClient.setQueryData(getGetPreferencesQueryKey(), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        leetcodeUsername: newUsername,
      };
    });
    
    updatePrefs.mutate({ 
      data: { leetcodeUsername: newUsername } as any 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPreferencesQueryKey() });
      }
    });
  }, [queryClient, updatePrefs]);

  return { myUsername, setMyUsername, isLoading };
}
