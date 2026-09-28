package main

import (
	"database/sql"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"smartfridge/database"

	"github.com/alexedwards/argon2id"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
)

const defaultPort = "8000"

//go:embed frontend/dist
var smartfridgeApp embed.FS

func createUser(userRepository *database.UserRepository, username string, password string) {
	hash, err := argon2id.CreateHash(password, argon2id.DefaultParams)
	if err != nil {
		log.Fatal(err)
	}

	user := database.User{
		Username:     username,
		PasswordHash: hash,
	}

	err = userRepository.CreateUser(&user)
}

func main() {
	println("Starting Smartfridge App")

	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	frontendFS, err := fs.Sub(smartfridgeApp, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	dbConnection, err := sql.Open("pgx", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}

	defer dbConnection.Close()

	userRepository := &database.UserRepository{Db: dbConnection}
	err = userRepository.CreateTable()
	if err != nil {
		log.Fatal(err)
	}

	productRepository := &database.ProductRepository{Db: dbConnection}
	err = productRepository.CreateTable()
	if err != nil {
		log.Fatal(err)
	}

	recipeRepository := &database.RecipeRepository{Db: dbConnection}
	err = recipeRepository.CreateTable()
	if err != nil {
		log.Fatal(err)
	}

	http.Handle("/", http.FileServer(http.FS(frontendFS)))

	port := os.Getenv("PORT")

	if port == "" {
		port = defaultPort
	}

	log.Printf("SmartFridge läuft auf http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
