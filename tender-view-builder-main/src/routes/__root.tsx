import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import React, { useEffect, type ReactNode } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Upload,
  ListChecks,
  Layers,
  BookOpen,
  ShieldCheck,
  History,
  Download,
  Sparkles,
  Moon,
  Sun
} from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

type Theme = "dark" | "light" | "system";

const ThemeProviderContext = React.createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  theme: "system",
  setTheme: () => null,
});

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
}: {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = React.useState<Theme>(
    () => {
      if (typeof window !== "undefined") {
        return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
      }
      return defaultTheme;
    }
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => React.useContext(ThemeProviderContext);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BRD Accelerator" },
      { name: "description", content: "AI-Powered BRD to User Stories Accelerator" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Read initial class from local storage synchronously to prevent flash of wrong theme
  let initialTheme = "dark";
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("vite-ui-theme");
      if (stored === "light" || stored === "dark") {
        initialTheme = stored;
      } else if (stored === "system" || !stored) {
        initialTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    } catch (e) {}
  }

  return (
    <html lang="en" className={initialTheme}>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              const stored = localStorage.getItem("vite-ui-theme");
              const root = document.documentElement;
              root.classList.remove("light", "dark");
              if (stored === "light" || stored === "dark") {
                root.classList.add(stored);
              } else {
                const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                root.classList.add(system);
              }
            } catch(e) {}
          `
        }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/upload", label: "Upload BRD", icon: Upload },
  { to: "/requirements", label: "Requirements", icon: ListChecks },
  { to: "/epics", label: "Epics", icon: Layers },
  { to: "/stories", label: "User Stories", icon: BookOpen },
  { to: "/validation", label: "Validation", icon: ShieldCheck },
  { to: "/history", label: "History", icon: History },
  { to: "/export", label: "Export", icon: Download },
] as const;

function Sidebar() {
  const routerState = useRouterState();
  const search = routerState.location.search as { workflowId?: string };
  const workflowId = search.workflowId;
  const { theme, setTheme } = useTheme();

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">BRD Accelerator</div>
          <div className="text-[10px] text-muted-foreground">AI-Powered</div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            search={workflowId ? { workflowId } : undefined}
            activeOptions={{ exact: to === "/" }}
            className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary data-[status=active]:font-medium"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-sidebar-border text-xs text-muted-foreground flex items-center justify-between">
        <span>v1.0</span>
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="p-1.5 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          title="Toggle Theme"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen bg-background text-foreground transition-colors duration-200">
          <Sidebar />
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
