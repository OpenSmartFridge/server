import { useState, type FormEvent } from "react";

export interface LoggedInUser {
  id: number;
  username: string;
  diet: string | null;
  is_admin: boolean;
}

interface LoginPageProps {
  onLoginSuccess: (user: LoggedInUser) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setError((await response.text()) || "Login fehlgeschlagen.");
        return;
      }
      const data: { user: LoggedInUser } = await response.json();
      onLoginSuccess(data.user);
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>SmartFridge Login</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          placeholder="Benutzername"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Passwort"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && (
          <p style={{ color: "var(--error)", textAlign: "center" }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={loading}>
          {loading ? "Anmelden..." : "Login"}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
