package database

import "database/sql"

type UserRepository struct {
	Db *sql.DB
}

type User struct {
	Id           int
	Username     string
	PasswordHash string
	Diet         string
}

func (r *UserRepository) CreateTable() error {
	_, err := r.Db.Exec(`CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    passwordhash VARCHAR(255) NOT NULL,
	diet TEXT
)`)

	return err
}

func (r *UserRepository) CreateUser(user *User) error {
	_, err := r.Db.Exec(`INSERT INTO users (username, passwordhash) VALUES (?, ?)`, user.Username, user.PasswordHash)

	return err
}
