import { useState, useEffect } from "react";

const STORAGE_KEY = "lc_my_username";

export function useMyProfile() {
  const [myUsername, setMyUsernameState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const setMyUsername = (username: string | null) => {
    try {
      if (username) {
        localStorage.setItem(STORAGE_KEY, username.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    setMyUsernameState(username ? username.trim() : null);
  };

  // Sync if another tab changes it
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setMyUsernameState(e.newValue || null);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return { myUsername, setMyUsername };
}
