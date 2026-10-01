package database

import (
	"database/sql"
	"time"
)

type SessionRepository struct {
	Db *sql.DB
}

type Session struct {
	Token  string
	Data   []byte
	Expiry time.Time
}

func (r *SessionRepository) CreateTable() error {
	_, err := r.Db.Exec(`
	CREATE TABLE IF NOT EXISTS sessions (
		token TEXT PRIMARY KEY,
		data BYTEA NOT NULL,
		expiry TIMESTAMPTZ NOT NULL
	);

	CREATE INDEX IF NOT EXISTS sessions_expiry_idx
	ON sessions (expiry);
`)

	return err
}
