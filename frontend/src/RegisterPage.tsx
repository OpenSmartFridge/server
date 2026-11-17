import { useState, type FormEvent } from "react";

interface RegisterPageProps {
  onRegistered: () => void;
  onShowLogin: () => void;
}

export function RegisterPage({ onRegistered, onShowLogin }: RegisterPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/create_user", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setError((await response.text()) || "Registrierung fehlgeschlagen.");
        return;
      }
      onRegistered();
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>Konto erstellen</h1>
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
          autoComplete="new-password"
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
          {loading ? "Registrieren..." : "Registrieren"}
        </button>
        <button type="button" className="link-button" onClick={onShowLogin}>
          Zurück zum Login
        </button>
      </form>
    </div>
  );
}

export default RegisterPage;
