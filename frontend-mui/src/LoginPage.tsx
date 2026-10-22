import { useState, type FormEvent } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Container,
  Paper,
} from "@mui/material";

export interface LoggedInUser {
  id: number;
  username: string;
  diet: { String: string; Valid: boolean };
  is_admin: boolean;
}

interface LoginPageProps {
  onLoginSuccess: (user: LoggedInUser) => void;
  onShowRegister: () => void;
}

export function LoginPage({ onLoginSuccess, onShowRegister }: LoginPageProps) {
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
    <Container
      maxWidth="xs"
      sx={{ display: "flex", alignItems: "center", minHeight: "100vh" }}
    >
      <Paper variant="outlined" sx={{ p: 4, width: "100%" }}>
        <Typography variant="h5" component="h1" align="center" gutterBottom>
          SmartFridge Login
        </Typography>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}
        >
          <TextField
            type="text"
            name="username"
            label="Benutzername"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            fullWidth
          />
          <TextField
            type="password"
            name="password"
            label="Passwort"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            fullWidth
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            variant="contained"
            type="submit"
            disabled={loading}
            fullWidth
          >
            {loading ? "Anmelden..." : "Login"}
          </Button>
          <Button variant="text" onClick={onShowRegister} fullWidth>
            Konto erstellen
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

export default LoginPage;
