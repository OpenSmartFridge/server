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
	_, err := r.Db.Exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            expire DATE,
            position INTEGER NOT NULL DEFAULT 0
        )
    `)

	if err != nil {
		return err
	}

	_, err = r.Db.Exec(`
        CREATE INDEX IF NOT EXISTS idx_products_user_id
        ON products(user_id)
    `)

	return err
}

func (r *ProductRepository) CreateProduct(product *Product) error {
	_, err := r.Db.Exec(`INSERT INTO products (user_id, name, expire) VALUES ($1, $2, $3)`, product.UserId, product.Name, product.Expire)

	return err
}

func (r *ProductRepository) GetProducts(userId int) ([]Product, error) {
	var products []Product

	rows, err := r.Db.Query(`SELECT id, user_id, name, expire, position FROM products WHERE user_id = $1`, userId)
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

	err = rows.Err()
	if err != nil {
		return products, err
	}

	return products, nil
}

func (r *ProductRepository) GetProductById(id int, UserId int) (Product, error) {
	var p Product

	err := r.Db.QueryRow(`SELECT id, user_id, name, expire, position FROM products WHERE id = $1 AND user_id = $2`, id, UserId).Scan(&p.Id, &p.UserId, &p.Name, &p.Expire, &p.Position)
	if err != nil {
		return p, err
	}

	return p, nil
}

func (r *ProductRepository) DeleteProduct(id int, userId int) error {
	result, err := r.Db.Exec(`DELETE FROM products WHERE id = $1 AND user_id = $2`, id, userId)

	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *ProductRepository) UpdateProduct(product *Product, userId int) error {
	result, err := r.Db.Exec(`UPDATE products SET name = $1, expire = $2, position = $3 WHERE id = $4 AND user_id = $5`, product.Name, product.Expire, product.Position, product.Id, userId)

	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}
