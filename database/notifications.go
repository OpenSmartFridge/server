package database

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type NotificationRepository struct {
	Db *sql.DB
}

type NotificationProvider struct {
	Id       int
	UserId   int
	Provider string
	BaseUrl  string
	Key      string
	Topic    string
}

type Notification struct {
	Title    string `json:"title"`
	Message  string `json:"message"`
	Priority int    `json:"priority"`
}

func (r *NotificationRepository) CreateTable() error {
	_, err := r.Db.Exec(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL,
        provider TEXT NOT NULL,
        base_url TEXT NOT NULL,
        key TEXT,
        topic TEXT
    )`)

	_, err = r.Db.Exec(`
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id
        ON notifications(user_id)
    `)

	return err
}

func (r *NotificationRepository) InsertProvider(provider NotificationProvider) error {
	_, err := r.Db.Exec(`DELETE FROM notifications WHERE user_id = $1`, provider.UserId)
	if err != nil || errors.Is(err, sql.ErrNoRows) {
		return err
	}

	_, err = r.Db.Exec(`INSERT INTO notifications(user_id, provider, base_url, key, topic) VALUES ($1,$2,$3,$4,$5)`, provider.UserId, provider.Provider, provider.BaseUrl, provider.Key, provider.Topic)

	return err
}

func (r *NotificationRepository) SendNotification(userId int, notification Notification) error {
	var provider NotificationProvider

	err := r.Db.QueryRow(`SELECT * FROM notifications WHERE user_id = $1`, userId).Scan(&provider.Id, &provider.UserId, &provider.Provider, &provider.BaseUrl, &provider.Key, &provider.Topic)
	if err != nil {
		return err
	}

	switch provider.Provider {
	case "gotify":
		jsonData, err := json.Marshal(notification)
		if err != nil {
			return err
		}
		req, err := http.NewRequest("POST", provider.BaseUrl+"/message", bytes.NewBuffer(jsonData))
		if err != nil {
			return err
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Gotify-Key", provider.Key)

		client := &http.Client{Timeout: time.Second * 10}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer func(Body io.ReadCloser) {
			err := Body.Close()
			if err != nil {
				return
			}
		}(resp.Body)

		if resp.StatusCode != http.StatusOK {
			return errors.New(resp.Status)
		}
	case "ntfy":
		notification.Priority = 5

		req, err := http.NewRequest("POST", provider.BaseUrl+"/"+provider.Topic, strings.NewReader(notification.Message))
		if err != nil {
			return err
		}

		req.Header.Set("Title", notification.Title)
		req.Header.Set("Priority", strconv.Itoa(notification.Priority))

		client := &http.Client{Timeout: time.Second * 10}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer func(Body io.ReadCloser) {
			err := Body.Close()
			if err != nil {
				return
			}
		}(resp.Body)

		if resp.StatusCode != http.StatusOK {
			return errors.New(resp.Status)
		}
	}

	return err
}

func (r *NotificationRepository) GetUsers() ([]int, error) {
	rows, err := r.Db.Query(`SELECT DISTINCT user_id FROM notifications`)
	if err != nil {
		return nil, err
	}
	defer func(rows *sql.Rows) {
		err := rows.Close()
		if err != nil {
			return
		}
	}(rows)

	var users []int

	for rows.Next() {
		var userId int

		if err := rows.Scan(&userId); err != nil {
			return nil, err
		}

		users = append(users, userId)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}
