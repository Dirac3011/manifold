"use client";

import { useEffect } from "react";
import { applyAppTheme, loadAppTheme } from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyAppTheme(loadAppTheme());
  }, []);

  return <>{children}</>;
}
