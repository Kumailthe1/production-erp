"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useDispatch, useSelector } from "react-redux";
import { selectTheme, setTheme } from "@/lib/userSlice";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const currentTheme = useSelector(selectTheme);

  // Initialize theme from Redux store
  const handleThemeChange = (theme: string) => {
    dispatch(setTheme(theme));
  };

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={currentTheme || "light"}
      enableSystem={false}
      //onValueChange={handleThemeChange}
    >
      {children}
    </NextThemesProvider>
  );
}