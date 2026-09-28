package database

import (
	"database/sql"
	"time"
)

type RecipeRepository struct {
	Db *sql.DB
}

type Recipe struct {
	Id         int
	UserId     int
	RecipeKey  string
	CreatedAt  time.Time
	IsFavorite bool
	Recipes    []byte
	Position   int
}

func (r *RecipeRepository) CreateTable() error {
	_, err := r.Db.Exec(`CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    recipe_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_favourite BOOLEAN,
    recipe jsonb,
    position INTEGER
)`)

	return err
}
