package database

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"fmt"
)

type ApiRepository struct {
	Db *sql.DB
}

type ApiKey struct {
	Id     int
	Key    string
	UserId int
}

func (r *ApiRepository) CreateTable() error {
	_, err := r.Db.Exec(`CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL
)`)

	return err
}

func (r *ApiRepository) CreateKey(userId int) (string, error) {
	bytes := make([]byte, 32)

	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}

	key := base64.RawURLEncoding.EncodeToString(bytes)

	hash := sha256.Sum256([]byte(key))
	keyHash := fmt.Sprintf("%x", hash)

	_, err = r.Db.Exec(`DELETE FROM api_keys WHERE user_id = $1`, userId)
	if err != nil {
		return "", err
	}

	_, err = r.Db.Exec(`INSERT INTO api_keys (key, user_id) VALUES ($1, $2)`, keyHash, userId)
	if err != nil {
		return "", err
	}

	return key, nil
}

func (r *ApiRepository) GetUserId(key string) (int, error) {
	var userId int

	hash := sha256.Sum256([]byte(key))
	keyHash := fmt.Sprintf("%x", hash)

	err := r.Db.QueryRow(`SELECT user_id FROM api_keys WHERE key = $1`, keyHash).Scan(&userId)
	if err != nil {
		return 0, err
	}

	return userId, nil
}

func (r *ApiRepository) DeleteApiKey(id int) error {
	_, err := r.Db.Exec(`DELETE FROM api_keys WHERE user_id = $1`, id)
	return err
}
