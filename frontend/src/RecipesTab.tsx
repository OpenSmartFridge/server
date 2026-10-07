import { useEffect, useState } from "react";
import { api } from "./api";
import type { Recipe } from "./types";

export function RecipesTab() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

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
      await api.generateRecipe();
      loadRecipes();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Rezept konnte nicht erstellt werden",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleGenerate} disabled={generating}>
        {generating ? "Rezept wird erstellt..." : "Neues Rezept generieren"}
      </button>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Lädt...</p>
      ) : recipes.length === 0 ? (
        <p>Noch keine Rezepte vorhanden.</p>
      ) : (
        <ul className="recipe-list">
          {recipes.map((recipe) => (
            <li key={recipe.Id} className="recipe-card">
              <h3>{recipe.name}</h3>
              <p>{recipe.description}</p>
              <p className="item-meta">{recipe.servings} Portionen</p>
              <strong>Zutaten</strong>
              <ul>
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={index}>
                    {ingredient.amount} {ingredient.unit} {ingredient.name}
                  </li>
                ))}
              </ul>
              <strong>Zubereitung</strong>
              <ol>
                {recipe.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RecipesTab;
