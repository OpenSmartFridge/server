import { useEffect, useState } from "react";
import { LoginPage, type LoggedInUser } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";
import { Dashboard } from "./Dashboard";

type View = "login" | "register";

export function App() {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState<View>("login");

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return null;
  }

  if (user) {
    return <Dashboard user={user} onUserChange={setUser} />;
  }

  if (view === "register") {
    return (
      <RegisterPage
        onRegistered={() => setView("login")}
        onShowLogin={() => setView("login")}
      />
    );
  }

  return (
    <LoginPage
      onLoginSuccess={setUser}
      onShowRegister={() => setView("register")}
    />
  );
}

export default App;
