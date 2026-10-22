import { useState } from "react";
import type { LoggedInUser } from "./LoginPage";
import { ProductsTab } from "./ProductsTab";
import { RecipesTab } from "./RecipesTab";
import { SettingsTab } from "./SettingsTab";
import {
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab as MuiTab,
  Box,
  Container,
} from "@mui/material";

type Tab = "products" | "recipes" | "settings";

interface DashboardProps {
  user: LoggedInUser;
  onUserChange: (user: LoggedInUser) => void;
}

export function Dashboard({ user, onUserChange }: DashboardProps) {
  const [tab, setTab] = useState<Tab>("products");

  return (
    <Box>
      <AppBar position="static" color="default" elevation={1}>
        <Container maxWidth="md">
          <Toolbar disableGutters sx={{ justifyContent: "space-between" }}>
            <Typography variant="h6" component="h1">
              SmartFridge
            </Typography>
            <Typography variant="body2">{user.username}</Typography>
          </Toolbar>
        </Container>
      </AppBar>

      <Container maxWidth="md">
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={tab}
            onChange={(_event, newValue: Tab) => setTab(newValue)}
            variant="fullWidth"
          >
            <MuiTab label="Produkte" value="products" />
            <MuiTab label="Rezepte" value="recipes" />
            <MuiTab label="Einstellungen" value="settings" />
          </Tabs>
        </Box>

        <Box sx={{ py: 3 }}>
          {tab === "products" && <ProductsTab userId={user.id} />}
          {tab === "recipes" && <RecipesTab />}
          {tab === "settings" && (
            <SettingsTab user={user} onUserChange={onUserChange} />
          )}
        </Box>
      </Container>
    </Box>
  );
}

export default Dashboard;
