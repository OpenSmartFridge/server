import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import type { LoggedInUser } from "./LoginPage";
import type { User } from "./types";

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

  function handleDeleteUser(id: number) {
    api.deleteUser(id);
  }

  return (
    <div>
      <section className="settings-section">
        <h2>Ernährung</h2>
        <form onSubmit={handleDietSubmit}>
          <textarea
            value={diet}
            onChange={(event) => setDiet(event.target.value)}
            placeholder="z.B. vegetarisch, keine Nüsse"
            rows={3}
          />
          {dietStatus && <p className="status-text">{dietStatus}</p>}
          <button type="submit" disabled={dietSaving}>
            Speichern
          </button>
        </form>
      </section>

      <section className="settings-section">
        <h2>Passwort ändern</h2>
        <form onSubmit={handlePasswordSubmit}>
          <input
            type="password"
            placeholder="Aktuelles Passwort"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Neues Passwort"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          {passwordStatus && <p className="status-text">{passwordStatus}</p>}
          <button type="submit" disabled={passwordSaving}>
            Ändern
          </button>
        </form>
      </section>

      <section className="settings-section">
        <h2>API-Schlüssel</h2>
        <p>
          Erzeuge einen Schlüssel für den externen Zugriff auf deine Produkte.
        </p>
        <button
          type="button"
          onClick={handleCreateKey}
          disabled={keyGenerating}
        >
          {keyGenerating ? "Erstelle..." : "Neuen Schlüssel erzeugen"}
        </button>
        {apiKey && (
          <p className="api-key-box">
            {apiKey}
            <br />
            Dieser Schlüssel wird nur einmal angezeigt.
          </p>
        )}
        {keyStatus && <p className="status-text">{keyStatus}</p>}
      </section>

      <section className="settings-section">
        <h2>User Management</h2>
        <ul className="user-list">
          {users.map((listedUser) => (
            <li className="user-list-item" key={listedUser.Id}>
              <span>{listedUser.Username}</span>
              <span className="item-meta">
                {listedUser.IsAdmin ? "Admin" : "Benutzer"}
                <button
                  onClick={() => {
                    handleDeleteUser(listedUser.Id);
                    loadUsers();
                  }}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default SettingsTab;
