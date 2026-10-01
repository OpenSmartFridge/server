package database

import (
	"database/sql"
	"log"
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
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER,
    name TEXT,
    expire DATE,
    position INTEGER NOT NULL DEFAULT 0
)`)

	return err
}

func (r *ProductRepository) CreateProduct(product *Product) error {
	_, err := r.Db.Exec(`INSERT INTO products (user_id, name, expire) VALUES ($1, $2, $3)`, product.UserId, product.Name, product.Expire)

	return err
}

func (r *ProductRepository) GetProducts(userId int) ([]Product, error) {
	var products []Product

	rows, err := r.Db.Query(`SELECT * FROM products WHERE user_id = $1`, userId)
	if err != nil {
		return products, err
	}

	defer func() {
		err = rows.Close()
		if err != nil {
			log.Printf("Error closing rows: %v", err)
		}
	}()

	for rows.Next() {
		var p Product

		err := rows.Scan(&p.Id, &p.UserId, &p.Name, &p.Expire, &p.Position)
		if err != nil {
			return products, err
		}
		products = append(products, p)
	}

	return products, nil
}

func (r *ProductRepository) GetProductById(id int) (Product, error) {
	var p Product

	err := r.Db.QueryRow(`SELECT * FROM products WHERE id = $1`, id).Scan(&p.Id, &p.UserId, &p.Name, &p.Expire, &p.Position)
	if err != nil {
		return p, err
	}

	return p, nil
}

func (r *ProductRepository) DeleteProduct(id int) error {
	_, err := r.Db.Exec(`DELETE FROM products WHERE id = $1`, id)

	return err
}
