import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";

export type ThemeMode = "light" | "dark" | "system";

export interface UseThemeReturn {
  theme: string;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
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

function isThemeMode(value: unknown): value is ThemeMode {
  return value === THEME_LIGHT || value === THEME_DARK || value === THEME_SYSTEM;
}

function getStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (isThemeMode(stored)) return stored;
  } catch {}
  return THEME_SYSTEM;
}

function resolveTheme(mode: ThemeMode) {
  return mode === THEME_SYSTEM ? getSystemTheme() : mode;
}

function applyTheme(theme: string) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

/**
 * 同步应用已存储的主题（防 FOUC）。
 * 库不再在 import 时产生全局副作用；使用方需在应用入口（或 index.html 内联脚本）主动调用。
 */
export function initTheme(): void {
  if (typeof window === "undefined") return;
  applyTheme(resolveTheme(getStoredMode()));
}

const ThemeContext = createContext<UseThemeReturn | null>(null);

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredMode());
  const [theme, setTheme] = useState<string>(() => resolveTheme(mode));
  /** 记录自身最后一次写入 data-theme 的值；MutationObserver 是异步回调，无法用布尔开关防回环 */
  const lastSelfAppliedRef = useRef<string | null>(null);

  /** 由本 Provider 主动应用主题，并登记来源，供外部变更同步时排除自身写入 */
  const applyThemeSelf = useCallback((next: string) => {
    lastSelfAppliedRef.current = next;
    applyTheme(next);
  }, []);

  // 首次挂载即应用主题，保证无 ThemeProvider 外部脚本时也能生效
  useLayoutEffect(() => {
    applyThemeSelf(resolveTheme(getStoredMode()));
  }, [applyThemeSelf]);

  const setMode = useCallback((newMode: ThemeMode) => {
    if (!isThemeMode(newMode)) {
      console.warn(`[render-markdown] 非法的主题模式: ${newMode}，应为 light | dark | system`);
      return;
    }
    setModeState(newMode);
    try {
      localStorage.setItem(THEME_KEY, newMode);
      window.dispatchEvent(new Event("storage"));
    } catch {}
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(mode);
    setTheme(resolved);
    applyThemeSelf(resolved);
  }, [mode, applyThemeSelf]);

  useEffect(() => {
    if (mode !== THEME_SYSTEM) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const t = e.matches ? THEME_DARK : THEME_LIGHT;
      setTheme(t);
      applyThemeSelf(t);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, applyThemeSelf]);

  useEffect(() => {
    const handleStorage = () => {
      const newMode = getStoredMode();
      if (newMode !== mode) {
        setModeState(newMode);
      }
    };
    window.addEventListener("storage", handleStorage);

    // 同步外部（使用方自行写 data-theme）变更；跳过自身写入，防多个 Provider 乒乓
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.dataset.theme;
      if (currentTheme === lastSelfAppliedRef.current) return;
      if ((currentTheme === THEME_LIGHT || currentTheme === THEME_DARK) && currentTheme !== theme) {
        setTheme(currentTheme);
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
