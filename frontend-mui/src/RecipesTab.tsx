import { useEffect, useState } from "react";
import { api } from "./api";
import type { Recipe } from "./types";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export function RecipesTab() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [newRecipe, setNewRecipe] = useState<Recipe | null>(null);

  function loadRecipes() {
    api
      .getRecipes()
      .then((data) => {
        setRecipes(data ?? []);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Fehler beim Laden"),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRecipes();
  }, []);

  async function handleGenerate() {
    setError("");
    setGenerating(true);
    try {
      const recipe = await api.generateRecipe();
      setNewRecipe(recipe);
      loadRecipes();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Rezept konnte nicht erstellt werden",
      );
    } finally {
      setGenerating(false);
    }
  }

  const closeDialog = () => {
    setNewRecipe(null);
  };

  function renderRecipeContent(recipe: Recipe) {
    return (
      <>
        <Typography variant="h6" component="h3" gutterBottom>
          {recipe.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {recipe.description}
        </Typography>
        <Chip
          label={`${recipe.servings} Portionen`}
          size="small"
          sx={{ mb: 2 }}
        />

        <Typography variant="subtitle2" sx={{ mt: 1 }}>
          Zutaten
        </Typography>
        <List dense disablePadding>
          {recipe.ingredients.map((ingredient, index) => (
            <ListItem key={index} disablePadding sx={{ pl: 1 }}>
              <ListItemText
                primary={`${ingredient.amount} ${ingredient.unit} ${ingredient.name}`}
              />
            </ListItem>
          ))}
        </List>

        <Typography variant="subtitle2" sx={{ mt: 2 }}>
          Zubereitung
        </Typography>
        <Box component="ol" sx={{ pl: 3, m: 0 }}>
          {recipe.steps.map((step, index) => (
            <Box component="li" key={index} sx={{ mb: 0.5 }}>
              <Typography variant="body2">{step}</Typography>
            </Box>
          ))}
        </Box>
      </>
    );
  }

  return (
    <Box>
      <Button
        variant="contained"
        onClick={handleGenerate}
        disabled={generating}
        sx={{ mb: 2 }}
      >
        {generating ? "Rezept wird erstellt..." : "Neues Rezept generieren"}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Dialog open={!!newRecipe} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{newRecipe?.name}</DialogTitle>
        <DialogContent dividers>
          {newRecipe && renderRecipeContent(newRecipe)}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={closeDialog}>
            Schließen
          </Button>
        </DialogActions>
      </Dialog>

      {loading ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} />
          <Typography>Lädt...</Typography>
        </Box>
      ) : recipes.length === 0 ? (
        <Typography>Noch keine Rezepte vorhanden.</Typography>
      ) : (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Rezepte</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[...recipes].reverse().map((recipe) => (
                <Card key={recipe.Id} variant="outlined">
                  <CardContent>{renderRecipeContent(recipe)}</CardContent>
                </Card>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}

export default RecipesTab;
