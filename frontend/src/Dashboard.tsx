import { useState } from "react";
import type { LoggedInUser } from "./LoginPage";
import { ProductsTab } from "./ProductsTab";
import { RecipesTab } from "./RecipesTab";
import { SettingsTab } from "./SettingsTab";

type Tab = "products" | "recipes" | "settings";

interface DashboardProps {
  user: LoggedInUser;
  onUserChange: (user: LoggedInUser) => void;
}

export function Dashboard({ user, onUserChange }: DashboardProps) {
  const [tab, setTab] = useState<Tab>("products");

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>SmartFridge</h1>
        <span className="dashboard-user">{user.username}</span>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={tab === "products" ? "tab tab-active" : "tab"}
          onClick={() => setTab("products")}
        >
          Produkte
        </button>
        <button
          type="button"
          className={tab === "recipes" ? "tab tab-active" : "tab"}
          onClick={() => setTab("recipes")}
        >
          Rezepte
        </button>
        <button
          type="button"
          className={tab === "settings" ? "tab tab-active" : "tab"}
          onClick={() => setTab("settings")}
        >
          Einstellungen
        </button>
      </nav>

      <main className="tab-content">
        {tab === "products" && <ProductsTab userId={user.id} />}
        {tab === "recipes" && <RecipesTab />}
        {tab === "settings" && (
          <SettingsTab user={user} onUserChange={onUserChange} />
        )}
      </main>
    </div>
  );
}

export default Dashboard;
