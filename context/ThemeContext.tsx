import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeChoice = "Dark" | "Light" | "System";

export type Colors = {
  bg: string;
  card: string;
  card2: string;
  text: string;
  muted: string;
  border: string;
  cardBorder: string;
  inputBg: string;
  rowPress: string;
  divider: string;
  tint: "dark" | "light";
  statusBar: "light" | "dark";
  isDark: boolean;
};

const DARK: Colors = {
  bg: "#0d0d0d",
  card: "#141414",
  card2: "#1a1a1a",
  text: "#f5f5f5",
  muted: "#666",
  border: "#222",
  cardBorder: "rgba(255,255,255,0.08)",
  inputBg: "#1a1a1a",
  rowPress: "rgba(255,255,255,0.04)",
  divider: "rgba(255,255,255,0.05)",
  tint: "dark",
  statusBar: "light",
  isDark: true,
};

const LIGHT: Colors = {
  bg: "#f5f5f5",
  card: "#ffffff",
  card2: "#eeeeee",
  text: "#111111",
  muted: "#888",
  border: "#e0e0e0",
  cardBorder: "rgba(0,0,0,0.08)",
  inputBg: "#f0f0f0",
  rowPress: "rgba(0,0,0,0.04)",
  divider: "rgba(0,0,0,0.06)",
  tint: "light",
  statusBar: "dark",
  isDark: false,
};

function resolveColors(choice: ThemeChoice): Colors {
  if (choice === "Dark") return DARK;
  if (choice === "Light") return LIGHT;
  return Appearance.getColorScheme() === "light" ? LIGHT : DARK;
}

type ThemeContextValue = {
  themeChoice: ThemeChoice;
  colors: Colors;
  isDark: boolean;
  setTheme: (t: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  themeChoice: "Dark",
  colors: DARK,
  isDark: true,
  setTheme: () => {},
});

const STORAGE_KEY = "muves_theme_v1";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("Dark");
  const [colors, setColors] = useState<Colors>(DARK);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      const saved = raw as ThemeChoice | null;
      if (saved === "Dark" || saved === "Light" || saved === "System") {
        setThemeChoice(saved);
        setColors(resolveColors(saved));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(() => {
      setThemeChoice(prev => {
        if (prev === "System") setColors(resolveColors("System"));
        return prev;
      });
    });
    return () => sub.remove();
  }, []);

  const setTheme = useCallback((choice: ThemeChoice) => {
    setThemeChoice(choice);
    setColors(resolveColors(choice));
    AsyncStorage.setItem(STORAGE_KEY, choice).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ themeChoice, colors, isDark: colors.isDark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useColors(): Colors {
  return useContext(ThemeContext).colors;
}
