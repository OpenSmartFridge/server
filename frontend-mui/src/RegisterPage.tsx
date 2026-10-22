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
    <Container
      maxWidth="xs"
      sx={{ display: "flex", alignItems: "center", minHeight: "100vh" }}
    >
      <Paper variant="outlined" sx={{ p: 4, width: "100%" }}>
        <Typography variant="h5" component="h1" align="center" gutterBottom>
          Konto erstellen
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
            autoComplete="new-password"
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
            {loading ? "Registrieren..." : "Registrieren"}
          </Button>
          <Button variant="text" onClick={onShowLogin} fullWidth>
            Zurück zum Login
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

export default RegisterPage;
