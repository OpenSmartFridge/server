import { useState } from "react";
import { LoginPage, type LoggedInUser } from "./LoginPage";

export function App() {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  if (!user) {
    return <LoginPage onLoginSuccess={setUser} />;
  }
  return (
    <div className="container">
      <h1>SmartFridge</h1>
      <p style={{ textAlign: "center" }}>
        Erfolgreich eingeloggt als <strong>{user.username}</strong>
      </p>
    </div>
  );
}

export default App;
