import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import type { LoggedInUser } from "./LoginPage";
import type { User } from "./types";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Stack,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

interface SettingsTabProps {
  user: LoggedInUser;
  onUserChange: (user: LoggedInUser) => void;
}

export function SettingsTab({ user, onUserChange }: SettingsTabProps) {
  const [diet, setDiet] = useState(user.diet.Valid ? user.diet.String : "");
  const [dietStatus, setDietStatus] = useState("");
  const [dietSaving, setDietSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState("");
  const [keyGenerating, setKeyGenerating] = useState(false);

  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    async function loadUsers() {
      setUsers(await api.getUsers());
    }

    void loadUsers();
  }, []);

  async function loadUsers() {
    setUsers(await api.getUsers());
  }

  async function handleDietSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDietStatus("");
    setDietSaving(true);
    try {
      await api.updateDiet(diet);
      onUserChange({ ...user, diet: { String: diet, Valid: diet !== "" } });
      setDietStatus("Gespeichert.");
    } catch (err) {
      setDietStatus(
        err instanceof Error ? err.message : "Fehler beim Speichern",
      );
    } finally {
      setDietSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordStatus("");
    setPasswordSaving(true);
    try {
      await api.updatePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordStatus("Passwort geändert.");
    } catch (err) {
      setPasswordStatus(
        err instanceof Error ? err.message : "Fehler beim Ändern",
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleCreateKey() {
    setKeyStatus("");
    setKeyGenerating(true);
    try {
      const result = await api.createApiKey();
      setApiKey(result.key);
    } catch (err) {
      setKeyStatus(
        err instanceof Error ? err.message : "Fehler beim Erstellen",
      );
    } finally {
      setKeyGenerating(false);
    }
  }

  async function handleDeleteUser(id: number) {
    await api.deleteUser(id);
    await loadUsers();
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Ernährung
        </Typography>
        <Box
          component="form"
          onSubmit={handleDietSubmit}
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            alignItems: "flex-start",
          }}
        >
          <TextField
            value={diet}
            onChange={(event) => setDiet(event.target.value)}
            placeholder="z.B. vegetarisch, keine Nüsse"
            multiline
            rows={3}
            fullWidth
          />
          {dietStatus && <Alert severity="info">{dietStatus}</Alert>}
          <Button variant="contained" type="submit" disabled={dietSaving}>
            Speichern
          </Button>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Passwort ändern
        </Typography>
        <Box
          component="form"
          onSubmit={handlePasswordSubmit}
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            alignItems: "flex-start",
          }}
        >
          <TextField
            type="password"
            label="Aktuelles Passwort"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            fullWidth
          />
          <TextField
            type="password"
            label="Neues Passwort"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            fullWidth
          />
          {passwordStatus && <Alert severity="info">{passwordStatus}</Alert>}
          <Button variant="contained" type="submit" disabled={passwordSaving}>
            Ändern
          </Button>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          API-Schlüssel
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Erzeuge einen Schlüssel für den externen Zugriff auf deine Produkte.
        </Typography>
        <Button
          variant="contained"
          onClick={handleCreateKey}
          disabled={keyGenerating}
          sx={{ mb: 1.5 }}
        >
          {keyGenerating ? "Erstelle..." : "Neuen Schlüssel erzeugen"}
        </Button>
        {apiKey && (
          <Alert severity="success" sx={{ mb: 1.5, fontFamily: "monospace" }}>
            {apiKey}
            <br />
            Dieser Schlüssel wird nur einmal angezeigt.
          </Alert>
        )}
        {keyStatus && <Alert severity="error">{keyStatus}</Alert>}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          User Management
        </Typography>
        <List disablePadding>
          {users.map((listedUser) => (
            <ListItem
              key={listedUser.Id}
              divider
              secondaryAction={
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <Chip
                    label={listedUser.IsAdmin ? "Admin" : "Benutzer"}
                    size="small"
                    color={listedUser.IsAdmin ? "primary" : "default"}
                  />
                  <IconButton
                    edge="end"
                    color="error"
                    aria-label="Löschen"
                    onClick={() => void handleDeleteUser(listedUser.Id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              }
            >
              <ListItemText primary={listedUser.Username} />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}

export default SettingsTab;
