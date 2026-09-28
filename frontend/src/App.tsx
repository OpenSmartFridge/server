import { Component } from "react";

export class App extends Component {
  render() {
    return (
      <>
        <div className="container">
          <h1>Login</h1>
          <p style={{ color: "red" }}></p>

          <form method="POST">
            <input
              type="text"
              name="username"
              placeholder="Benutzername"
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Passwort"
              required
            />

            <button type="submit">Login</button>
          </form>

          <h1>🧊 Mein Kühlschrank</h1>

          <div className="user-header">
            <p>
              Willkommen! |{" "}
              <a href="#" id="settingsLink">
                ⚙️ Einstellungen
              </a>{" "}
              | <a href="/logout">Logout</a>
            </p>

            <button className="theme-toggle" id="themeToggle">
              <span id="themeIcon">🌙</span>
              <span id="themeText">Dark</span>
            </button>
          </div>

          <form
            method="POST"
            id="form"
            style={{
              marginBottom: 10,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                height: 48,
              }}
            >
              <input
                type="text"
                id="barcode"
                name="barcode"
                placeholder="Barcode eingeben"
                autoComplete="off"
                style={{
                  width: "100%",
                  height: "100%",
                  padding: "0 44px 0 16px",
                  borderRadius: "14px",
                  border: "1px solid #ccc",
                  boxSizing: "border-box",
                  fontSize: "16px",
                  lineHeight: "48px",
                }}
              />

              <button
                type="button"
                id="manualBtn"
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "none",
                  background: "#4facfe",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: 20,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                +
              </button>
            </div>

            <input
              type="text"
              id="manualName"
              name="manual_name"
              placeholder="Produktname eingeben"
            />

            <input type="date" name="ablauf" />

            <button type="submit" name="add">
              ➕ Produkt hinzufügen
            </button>
          </form>

          <div id="reader"></div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              id="suche"
              placeholder="Produkt suchen..."
              style={{
                flex: 1,
                minWidth: 150,
              }}
            />

            <button
              type="button"
              id="aiRecipeBtn"
              style={{
                width: "auto",
                padding: "14px 20px",
                whiteSpace: "nowrap",
                background: "linear-gradient(to right, #ff6b6b, #ff8e53)",
              }}
            >
              <img
                className="kitchenai-icon"
                src="/static/icons/kitchai.png"
                alt=""
              />
              KitchenAI
            </button>

            <button
              type="button"
              id="recipeHistoryBtn"
              style={{
                width: "auto",
                padding: "14px 20px",
                whiteSpace: "nowrap",
                background: "linear-gradient(to right, #8e44ad, #c39bd3)",
              }}
            >
              📖 Rezeptbuch
            </button>
          </div>

          <div className="produkt-liste" id="produktListe">
            <div className="produkt" data-index={0} data-name="" data-ablauf="">
              <div className="produkt-name"></div>

              <form
                method="POST"
                onSubmit={(e) => {
                  if (
                    !window.confirm("Willst du das Produkt wirklich löschen?")
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="delete" value={0} />

                <button type="submit" className="delete-btn">
                  🗑️
                </button>
              </form>
            </div>

            <p className="leer">Noch keine Produkte eingetragen</p>
          </div>
        </div>

        <div
          id="devOverlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--modal-bg)",
              color: "var(--text-primary)",
              width: "95%",
              maxWidth: 500,
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 10px 30px var(--shadow-dark)",
              overflowY: "auto",
              maxHeight: "90vh",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="devTitle"
          >
            <h2
              id="devTitle"
              style={{
                textAlign: "center",
                marginBottom: 24,
                color: "var(--text-primary)",
              }}
            >
              Developer Fenster - Admin Panel
            </h2>

            <div
              style={{
                background: "var(--dev-list-bg, #f0f8ff)",
                padding: 18,
                borderRadius: 16,
                marginBottom: 20,
                border: "1px solid var(--input-border)",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  color: "var(--accent-blue)",
                  fontSize: "1.1rem",
                  marginBottom: 14,
                }}
              >
                🤖 KI-Anbieter konfigurieren
              </h3>

              <form
                id="aiConfigForm"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <label
                  style={{
                    fontWeight: 500,
                    fontSize: "0.9rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Provider:
                </label>

                <select
                  id="aiProvider"
                  name="provider"
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid var(--input-border)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="gemini">Google Gemini AI</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                  <option value="ollama">Ollama (Lokal)</option>
                </select>

                <div
                  id="aiGeminiSettings"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <input
                    type="password"
                    id="geminiApiKey"
                    name="gemini_api_key"
                    placeholder="Gemini API Key"
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--input-border)",
                      width: "100%",
                      boxSizing: "border-box",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />

                  <input
                    type="text"
                    id="geminiModel"
                    name="gemini_model"
                    placeholder="Model (z.B. gemini-2.5-flash)"
                    defaultValue="gemini-2.5-flash"
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--input-border)",
                      width: "100%",
                      boxSizing: "border-box",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <div
                  id="aiOpenAISettings"
                  style={{
                    display: "none",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <input
                    type="password"
                    id="openaiApiKey"
                    name="openai_api_key"
                    placeholder="OpenAI API Key"
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--input-border)",
                      width: "100%",
                      boxSizing: "border-box",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />

                  <input
                    type="text"
                    id="openaiModel"
                    name="openai_model"
                    placeholder="Model (z.B. gpt-4o-mini)"
                    defaultValue="gpt-4o-mini"
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--input-border)",
                      width: "100%",
                      boxSizing: "border-box",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <div
                  id="aiOllamaSettings"
                  style={{
                    display: "none",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <input
                    type="text"
                    id="ollamaUrl"
                    name="ollama_url"
                    placeholder="API URL"
                    defaultValue="http://localhost:11434/api/generate"
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--input-border)",
                      width: "100%",
                      boxSizing: "border-box",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />

                  <input
                    type="text"
                    id="ollamaModel"
                    name="ollama_model"
                    placeholder="Model (z.B. llama3.2)"
                    defaultValue="llama3.2"
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--input-border)",
                      width: "100%",
                      boxSizing: "border-box",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <button
                  type="button"
                  id="aiConfigSaveBtn"
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: "#28a745",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginTop: 5,
                  }}
                >
                  💾 KI Speichern
                </button>

                <div
                  id="aiConfigMsg"
                  style={{
                    fontSize: "0.85rem",
                    textAlign: "center",
                    marginTop: 5,
                  }}
                />
              </form>
            </div>

            <div
              style={{
                background: "var(--dev-list-bg, #fff9f0)",
                padding: 18,
                borderRadius: 16,
                marginBottom: 20,
                border: "1px solid var(--input-border)",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  color: "var(--accent-orange)",
                  fontSize: "1.1rem",
                  marginBottom: 14,
                }}
              >
                🔑 API Einstellungen
              </h3>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  id="adminApiKey"
                  placeholder="API Key"
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid var(--input-border)",
                    margin: 0,
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />

                <button
                  type="button"
                  id="generateApiKeyBtn"
                  title="Generieren"
                  style={{
                    width: 48,
                    borderRadius: 8,
                    padding: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    background: "#6c757d",
                    margin: 0,
                  }}
                >
                  🔄
                </button>
              </div>

              <button
                type="button"
                id="saveApiSettingsBtn"
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: "#ffc107",
                  color: "#212529",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  marginTop: 10,
                  width: "100%",
                }}
              >
                💾 API Key Speichern
              </button>

              <div
                id="apiSettingsMsg"
                style={{
                  fontSize: "0.85rem",
                  textAlign: "center",
                  marginTop: 5,
                }}
              />

              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#856404",
                  marginTop: 8,
                  marginBottom: 0,
                }}
              >
                Endpoints: <code>/api/products</code> (Header:{" "}
                <code>API-Key</code>)
              </p>
            </div>

            <hr
              style={{
                border: "none",
                borderTop: "1px solid var(--input-border)",
                margin: "24px 0",
              }}
            />

            <h3
              style={{
                textAlign: "center",
                marginBottom: 18,
                color: "var(--text-primary)",
                fontSize: "1.1rem",
              }}
            >
              Benutzerverwaltung
            </h3>

            <form
              method="POST"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <input
                type="text"
                name="new_user"
                placeholder="Neuer Benutzer"
                required
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid var(--input-border)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                }}
              />

              <input
                type="password"
                name="new_pass"
                placeholder="Passwort"
                required
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid var(--input-border)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                }}
              />

              <button
                type="submit"
                name="add_user"
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "linear-gradient(to right, #4facfe, #00f2fe)",
                  color: "white",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ➕ Benutzer hinzufügen
              </button>
            </form>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <li
                style={{
                  background: "var(--dev-list-bg, #f9f9f9)",
                  padding: "12px 16px",
                  borderRadius: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "0 2px 6px var(--shadow-light)",
                  border: "1px solid var(--input-border)",
                }}
              >
                <span style={{ fontWeight: 500 }}>Benutzer</span>

                <form method="POST" style={{ margin: 0 }}>
                  <input type="hidden" name="delete_user" value="" />

                  <button
                    type="submit"
                    style={{
                      border: "2px solid red",
                      background: "white",
                      color: "red",
                      borderRadius: 12,
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    🗑️ Löschen
                  </button>
                </form>
              </li>
            </ul>

            <div
              style={{
                textAlign: "center",
                marginTop: 20,
              }}
            >
              <button
                type="button"
                id="devCloseBtn"
                style={{
                  padding: "10px 20px",
                  background: "red",
                  borderRadius: 12,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ❌ Schließen
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }
}

export default App;
