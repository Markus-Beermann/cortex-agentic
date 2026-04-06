import { SignOutButton, UserButton, useUser } from "@clerk/react";
import { Link, useLocation } from "react-router-dom";

function isAuthRoute(pathname: string): boolean {
  return pathname.startsWith("/sign-in");
}

export function AppHeader() {
  const { pathname } = useLocation();
  const { isLoaded, user } = useUser();

  if (isAuthRoute(pathname)) {
    return null;
  }

  const fullName = user?.fullName ?? user?.username ?? "Authenticated user";
  const email = user?.primaryEmailAddress?.emailAddress ?? "Access granted";

  return (
    <header className="topbar-shell">
      <div className="topbar-wrap">
        <div className="topbar">
          <Link to="/" className="topbar-brand">
            <strong>Cortex Dashboard</strong>
            <span>Protected run visibility for authenticated operators.</span>
          </Link>

          <nav className="topbar-nav" aria-label="Primary">
            <Link
              to="/"
              className={`topbar-nav-link${pathname === "/" ? " topbar-nav-link-active" : ""}`}
            >
              Runs
            </Link>
            <Link
              to="/deferred-tasks"
              className={`topbar-nav-link${pathname === "/deferred-tasks" ? " topbar-nav-link-active" : ""}`}
            >
              Tasks
            </Link>
            <Link
              to="/chat"
              className={`topbar-nav-link${pathname === "/chat" ? " topbar-nav-link-active" : ""}`}
            >
              Chat
            </Link>
          </nav>

          <div className="topbar-user">
            <div className="topbar-user-meta">
              <strong>{isLoaded ? fullName : "Loading user…"}</strong>
              <span>{isLoaded ? email : "Reading session…"}</span>
            </div>

            <div className="topbar-user-cluster">
              <UserButton />
              <SignOutButton>
                <button type="button" className="topbar-signout">
                  Sign out
                </button>
              </SignOutButton>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
