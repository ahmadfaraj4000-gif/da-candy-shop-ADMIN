import { useCallback, useState } from "react";

const AUTH_KEY = "dcs-admin-session";

export function useAuth() {
  const [isAuthed, setIsAuthed] = useState(() => localStorage.getItem(AUTH_KEY) === "active");

  const login = useCallback((email, password) => {
    if (!email || password.length < 6) {
      return { ok: false, message: "Enter an email and a password with at least 6 characters." };
    }
    localStorage.setItem(AUTH_KEY, "active");
    setIsAuthed(true);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthed(false);
  }, []);

  return { isAuthed, login, logout };
}
