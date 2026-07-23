import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

export interface UseThemeReturn {
  theme: string;
  mode: string;
  isDark: boolean;
  setMode: (mode: string) => void;
}

export interface ThemeProviderProps {
  children: React.ReactNode;
}

const THEME_KEY = "app-theme-mode";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
const THEME_SYSTEM = "system";

function getSystemTheme() {
  if (typeof window === "undefined") return THEME_LIGHT;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? THEME_DARK : THEME_LIGHT;
}

function getStoredMode() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === THEME_LIGHT || stored === THEME_DARK || stored === THEME_SYSTEM) return stored;
  } catch {}
  return THEME_SYSTEM;
}

function resolveTheme(mode: string) {
  return mode === THEME_SYSTEM ? getSystemTheme() : mode;
}

function applyTheme(theme: string) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

// 初始化脚本：在 React 加载前执行，防 FOUC（也内联在 index.ejs 中）
if (typeof window !== "undefined") {
  const mode = getStoredMode();
  const theme = resolveTheme(mode);
  applyTheme(theme);
}

const ThemeContext = createContext<UseThemeReturn | null>(null);

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setModeState] = useState(() => getStoredMode());
  const [theme, setTheme] = useState(() => resolveTheme(mode));

  const setMode = useCallback((newMode: string) => {
    setModeState(newMode);
    try {
      localStorage.setItem(THEME_KEY, newMode);
      window.dispatchEvent(new Event("storage"));
    } catch {}
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(mode);
    setTheme(resolved);
    applyTheme(resolved);
  }, [mode]);

  useEffect(() => {
    if (mode !== THEME_SYSTEM) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const t = e.matches ? THEME_DARK : THEME_LIGHT;
      setTheme(t);
      applyTheme(t);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  useEffect(() => {
    const handleStorage = () => {
      const newMode = getStoredMode();
      if (newMode !== mode) {
        setModeState(newMode);
      }
    };
    window.addEventListener("storage", handleStorage);

    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.dataset.theme;
      if (currentTheme && currentTheme !== theme) {
        setTheme(currentTheme);
        const newMode = getStoredMode();
        if (newMode !== mode) {
          setModeState(newMode);
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      window.removeEventListener("storage", handleStorage);
      observer.disconnect();
    };
  }, [mode, theme]);

  const isDark = theme === THEME_DARK;
  const value = useMemo(() => ({ theme, mode, isDark, setMode }), [theme, mode, isDark, setMode]);

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): UseThemeReturn {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

export { THEME_LIGHT, THEME_DARK, THEME_SYSTEM };
