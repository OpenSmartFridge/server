package database

import "database/sql"

type UserRepository struct {
	Db *sql.DB
}

type User struct {
	Id           int
	Username     string
	PasswordHash string
	Diet         sql.NullString
	IsAdmin      bool
}

func (r *UserRepository) CreateTable() error {
	_, err := r.Db.Exec(`CREATE TABLE IF NOT EXISTS users (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    passwordhash VARCHAR(255) NOT NULL,
	diet TEXT,
    is_admin BOOLEAN DEFAULT FALSE
)`)

	return err
}

func (r *UserRepository) CreateUser(user *User) error {
	_, err := r.Db.Exec(`INSERT INTO users (username, passwordhash) VALUES ($1, $2)`, user.Username, user.PasswordHash)

	return err
}

func (r *UserRepository) GetUserId(username string) (int, error) {
	var id int

	err := r.Db.QueryRow(`SELECT id FROM users WHERE username = $1`, username).Scan(&id)
	if err != nil {
		return 0, err
	}

	return id, nil
}

func (r *UserRepository) GetUser(id int) (*User, error) {
	var user User

	err := r.Db.QueryRow(`SELECT * FROM users WHERE id = $1`, id).Scan(&user.Id, &user.Username, &user.PasswordHash, &user.Diet, &user.IsAdmin)
	if err != nil {
		return nil, err
	}

	return &user, nil
}
