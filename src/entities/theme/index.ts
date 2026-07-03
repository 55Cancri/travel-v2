// Theme lives on <html data-theme>; Panda tokens and the map (via a
// MutationObserver in MapPane) both react to it. Persisted so reloads keep it.
export const THEME_KEY = "travel2:theme";

export const toggleTheme = () => {
  const root = document.documentElement;
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {}
};
