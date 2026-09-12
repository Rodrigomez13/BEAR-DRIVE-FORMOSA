import React, { createContext, useState, useEffect, useContext } from "react";
import { updateStatusBarStyle } from "@/lib/nativeSetup";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("bear_theme");
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("bear_theme", theme);
    updateStatusBarStyle(theme);
  }, [theme]);

  // Follow system theme changes only when no manual override has been set
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      if (!localStorage.getItem("bear_theme_manual")) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = () => {
    localStorage.setItem("bear_theme_manual", "true");
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);