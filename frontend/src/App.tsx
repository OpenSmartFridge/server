import { useState } from "react";
import { LoginPage, type LoggedInUser } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";

type View = "login" | "register";

export function App() {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [view, setView] = useState<View>("login");

  if (user) {
    return (
      <div className="container">
        <h1>SmartFridge</h1>
        <p style={{ textAlign: "center" }}>
          Erfolgreich eingeloggt als <strong>{user.username}</strong>
        </p>
      </div>
    );
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
