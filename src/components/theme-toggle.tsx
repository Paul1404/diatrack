import { Moon, Sun } from "lucide-react";
import { useTheme } from "~/components/theme-provider";
import { Button } from "~/components/ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Theme wechseln">
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
