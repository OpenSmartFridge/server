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

	err := r.Db.QueryRow(`SELECT id, username, passwordhash, diet, is_admin FROM users WHERE id = $1`, id).Scan(&user.Id, &user.Username, &user.PasswordHash, &user.Diet, &user.IsAdmin)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *UserRepository) UpdateDiet(id int, diet string) error {
	_, err := r.Db.Exec(`UPDATE users SET diet = $1 WHERE id = $2`, diet, id)
	return err
}

func (r *UserRepository) UpdatePasswordHash(id int, passwordHash string) error {
	_, err := r.Db.Exec(`UPDATE users SET passwordhash = $1 WHERE id = $2`, passwordHash, id)
	return err
}

func (r *UserRepository) IsAdmin(id int) (bool, error) {
	var isAdmin bool

	err := r.Db.QueryRow(`SELECT is_admin FROM users WHERE id = $1`, id).Scan(&isAdmin)
	if err != nil {
		return false, err
	}

	return isAdmin, nil
}

func (r *UserRepository) DeleteUser(id int) error {
	_, err := r.Db.Exec(`DELETE FROM users WHERE id = $1`, id)
	return err
}

func (r *UserRepository) GetUsers() ([]User, error) {
	var users []User

	result, err := r.Db.Query(`SELECT id, username, is_admin FROM users`)
	if err != nil {
		return nil, err
	}

	for result.Next() {
		var user User

		err = result.Scan(&user.Id, &user.Username, &user.IsAdmin)
		if err != nil {
			return nil, err
		}

		users = append(users, user)
	}

	return users, nil
}

func (r *UserRepository) ToggleAdmin(id int) error {
	_, err := r.Db.Exec(`UPDATE users SET is_admin = NOT is_admin WHERE id = $1`, id)

	return err
}
