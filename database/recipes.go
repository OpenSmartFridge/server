package database

import (
	"database/sql"
	"encoding/json"
	"time"
)

type RecipeRepository struct {
	Db *sql.DB
}

type Ingredient struct {
	Name   string  `json:"name"`
	Amount float64 `json:"amount"`
	Unit   string  `json:"unit"`
}

type Recipe struct {
	Id          int
	UserId      int
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Ingredients []Ingredient `json:"ingredients"`
	Steps       []string     `json:"steps"`
	Servings    int          `json:"servings"`
	CreatedAt   time.Time
	IsFavorite  bool
	Position    int
}

func (r *RecipeRepository) CreateTable() error {
	_, err := r.Db.Exec(`CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT,
        description TEXT,
        ingredients JSONB,
        steps JSONB,
        servings INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_favourite BOOLEAN DEFAULT FALSE,
        position INTEGER DEFAULT 0
    )`)

	_, err = r.Db.Exec(`
    CREATE INDEX IF NOT EXISTS idx_products_user_id_position
    ON products(user_id, position)
`)

	return err
}

func (r *RecipeRepository) CreateRecipe(recipe Recipe, userId int) error {
	ingredients, err := json.Marshal(recipe.Ingredients)
	if err != nil {
		return err
	}

	steps, err := json.Marshal(recipe.Steps)
	if err != nil {
		return err
	}

	_, err = r.Db.Exec(`INSERT INTO recipes (user_id, name, description, ingredients, steps, servings) VALUES($1, $2, $3, $4, $5, $6)`, userId, recipe.Name, recipe.Description, ingredients, steps, recipe.Servings)
	return err
}

func (r *RecipeRepository) GetRecipes(userId int) ([]Recipe, error) {
	var recipes []Recipe

	rows, err := r.Db.Query(`SELECT * FROM recipes WHERE user_id = $1`, userId)
	if err != nil {
		return nil, err
	}
	defer func(rows *sql.Rows) {
		err := rows.Close()
		if err != nil {
			return
		}
	}(rows)

	for rows.Next() {
		var r Recipe
		var i []byte
		var s []byte

		err := rows.Scan(&r.Id, &r.UserId, &r.Name, &r.Description, &i, &s, &r.Servings, &r.CreatedAt, &r.IsFavorite, &r.Position)
		if err != nil {
			return nil, err
		}

		err = json.Unmarshal(i, &r.Ingredients)
		if err != nil {
			return nil, err
		}

		err = json.Unmarshal(s, &r.Steps)
		if err != nil {
			return nil, err
		}

		recipes = append(recipes, r)
	}

	err = rows.Err()
	if err != nil {
		return nil, err
	}

	return recipes, nil
}

func (r *RecipeRepository) DeleteRecipe(id int, user_id int) error {
	_, err := r.Db.Exec(`DELETE FROM recipes WHERE id = $1 AND user_id = $2`, id, user_id)
	return err
}

func (r *RecipeRepository) DeleteRecipes(id int) error {
	_, err := r.Db.Exec(`DELETE FROM recipes WHERE user_id = $1`, id)
	return err
}

func (r *RecipeRepository) ToggleFavorite(id int, user_id int) error {
	_, err := r.Db.Exec(`UPDATE recipes SET is_favourite = NOT is_favourite WHERE id = $1 AND user_id = $2`, id, user_id)
	return err
}
