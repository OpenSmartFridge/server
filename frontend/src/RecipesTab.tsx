import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Recipe } from "./types";

export function RecipesTab() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [newRecipe, setNewRecipe] = useState<Recipe | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);

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

  useEffect(() => {
    if (newRecipe) {
      dialogRef.current?.showModal();
    }
  }, [newRecipe]);

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
    dialogRef.current?.close();
    setNewRecipe(null);
  };

  return (
    <div>
      <button type="button" onClick={handleGenerate} disabled={generating}>
        {generating ? "Rezept wird erstellt..." : "Neues Rezept generieren"}
      </button>

      {error && <p className="error-text">{error}</p>}

      <dialog ref={dialogRef} onClose={closeDialog}>
        {newRecipe && (
          <div className="recipe-card">
            <h3>{newRecipe.name}</h3>
            <p>{newRecipe.description}</p>
            <p className="item-meta">{newRecipe.servings} Portionen</p>
            <strong>Zutaten</strong>
            <ul>
              {newRecipe.ingredients.map((ingredient, index) => (
                <li key={index}>
                  {ingredient.amount} {ingredient.unit} {ingredient.name}
                </li>
              ))}
            </ul>
            <strong>Zubereitung</strong>
            <ol>
              {newRecipe.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            <button type="button" onClick={closeDialog}>
              Schließen
            </button>
          </div>
        )}
      </dialog>

      {loading ? (
        <p>Lädt...</p>
      ) : recipes.length === 0 ? (
        <p>Noch keine Rezepte vorhanden.</p>
      ) : (
        <details>
          <summary>Rezepte</summary>
          <ul className="recipe-list">
            {[...recipes].reverse().map((recipe) => (
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
        </details>
      )}
    </div>
  );
}

export default RecipesTab;
