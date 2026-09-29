package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"os"
	"smartfridge/database"

	"github.com/alexedwards/argon2id"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

const defaultPort = "8000"

//go:embed frontend/dist
var smartfridgeApp embed.FS

func createUser(userRepository *database.UserRepository, username string, password string) error {
	hash, err := argon2id.CreateHash(password, argon2id.DefaultParams)
	if err != nil {
		log.Fatal(err)
		return err
	}

	user := database.User{
		Username:     username,
		PasswordHash: hash,
	}

	err = userRepository.CreateUser(&user)

	return err
}

func createUserHandler(userRepository *database.UserRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}

		var request struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}

		err := json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		err = createUser(userRepository, request.Username, request.Password)
		if err != nil {
			log.Printf("CreateUser error: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)

		json.NewEncoder(w).Encode(map[string]string{"message": "User created successfully!"})
	}
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

	dbConnection, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
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

	http.Handle("/api/create_user", createUserHandler(userRepository))
	http.Handle("/", http.FileServer(http.FS(frontendFS)))

	port := os.Getenv("PORT")

	if port == "" {
		port = defaultPort
	}

	log.Printf("SmartFridge läuft auf http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
