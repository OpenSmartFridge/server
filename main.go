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
	"strconv"
	"time"

	"github.com/alexedwards/argon2id"
	"github.com/alexedwards/scs/v2"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

const defaultPort = "8000"

//go:embed frontend/dist
var smartfridgeApp embed.FS

var sessionManager *scs.SessionManager

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

func loginHandler(userRepository *database.UserRepository) http.HandlerFunc {
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

		id, err := userRepository.GetUserId(request.Username)
		if err != nil {
			log.Printf("Login error: %v", err)
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		user, err := userRepository.GetUser(id)
		if err != nil {
			log.Printf("Login error: %v", err)
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		match, err := argon2id.ComparePasswordAndHash(request.Password, user.PasswordHash)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		if !match {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		err = sessionManager.RenewToken(r.Context())
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		sessionManager.Put(r.Context(), "authenticated", true)
		sessionManager.Put(r.Context(), "username", user.Username)
		sessionManager.Put(r.Context(), "id", user.Id)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "User logged successfully!",
			"user": map[string]interface{}{
				"id":       user.Id,
				"username": user.Username,
				"diet":     user.Diet,
				"is_admin": user.IsAdmin,
			},
		})
	}
}

func meHandler(userRepository *database.UserRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}
		id, ok := sessionManager.Get(r.Context(), "id").(int)
		if !ok {
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
			return
		}

		user, err := userRepository.GetUser(id)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "authorized",
			"user": map[string]interface{}{
				"id":       user.Id,
				"username": user.Username,
				"diet":     user.Diet,
				"is_admin": user.IsAdmin,
			},
		})
	}
}

type spaFileSystem struct {
	base http.FileSystem
}

func (fs spaFileSystem) Open(name string) (http.File, error) {
	file, err := fs.base.Open(name)
	if err == nil {
		return file, nil
	}

	return fs.base.Open("index.html")
}

func main() {
	println("Starting Smartfridge App")

	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	isHTTPS, err := strconv.ParseBool(os.Getenv("HTTPS"))
	if err != nil {
		log.Fatal("Error parsing environment variable HTTPS")
	}

	sessionManager = scs.New()
	sessionManager.Lifetime = 24 * time.Hour
	sessionManager.Cookie.HttpOnly = true
	sessionManager.Cookie.Secure = isHTTPS
	sessionManager.Cookie.SameSite = http.SameSiteLaxMode

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
	http.Handle("/api/login", loginHandler(userRepository))
	http.Handle("/", http.FileServer(spaFileSystem{http.FS(frontendFS)}))
	http.Handle("/api/me", meHandler(userRepository))

	port := os.Getenv("PORT")

	if port == "" {
		port = defaultPort
	}

	log.Printf("SmartFridge läuft auf http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, sessionManager.LoadAndSave(http.DefaultServeMux)))
}
