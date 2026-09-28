package database

import (
	"database/sql"
	"time"
)

type ProductRepository struct {
	Db *sql.DB
}

type Product struct {
	Id       int
	UserId   int
	Name     string
	Expire   time.Time
	Position int
}

func (r *ProductRepository) CreateTable() error {
	_, err := r.Db.Exec(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    name TEXT,
    expire DATE,
    position INTEGER NOT NULL DEFAULT 0
)`)

	return err
}
