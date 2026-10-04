package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"smartfridge/database"
	"strconv"
	"time"

	"github.com/alexedwards/argon2id"
	"github.com/alexedwards/scs/postgresstore"
	"github.com/alexedwards/scs/v2"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

const defaultPort = "8000"

//go:embed frontend/dist
var smartfridgeApp embed.FS

var sessionManager *scs.SessionManager

var openFoodFactsURL = "https://world.openfoodfacts.net/api/v2/product/%s%s"

type ApiResponse struct {
	Code    string `json:"code"`
	Status  int    `json:"status"`
	Verbose string `json:"status_verbose"`
	Product struct {
		ProductName string `json:"product_name"`
	} `json:"product"`
}

func GetOutboundIP() net.IP {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		log.Fatal(err)
	}
	defer func() {
		err := conn.Close()
		if err != nil {
			log.Println(err)
		}
	}()

	localAddr := conn.LocalAddr().(*net.UDPAddr)

	return localAddr.IP
}

func createUser(userRepository *database.UserRepository, username string, password string) error {
	hash, err := argon2id.CreateHash(password, argon2id.DefaultParams)
	if err != nil {
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

		err = json.NewEncoder(w).Encode(map[string]string{"message": "User created successfully!"})
		if err != nil {
			return
		}
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
		err = json.NewEncoder(w).Encode(map[string]any{
			"message": "User logged successfully!",
			"user": map[string]any{
				"id":       user.Id,
				"username": user.Username,
				"diet":     user.Diet,
				"is_admin": user.IsAdmin,
			},
		})
		if err != nil {
			return
		}
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
		err = json.NewEncoder(w).Encode(map[string]any{
			"message": "authorized",
			"user": map[string]any{
				"id":       user.Id,
				"username": user.Username,
				"diet":     user.Diet,
				"is_admin": user.IsAdmin,
			},
		})
		if err != nil {
			return
		}
	}
}

func getProductsHandler(productRepository *database.ProductRepository) http.HandlerFunc {
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

		products, err := productRepository.GetProducts(id)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(products)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}
	}
}

func createProductHandler(productRepository *database.ProductRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}

		id, ok := sessionManager.Get(r.Context(), "id").(int)
		if !ok {
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
			return
		}

		var request struct {
			UserId int       `json:"user_id"`
			Name   string    `json:"name"`
			Expire time.Time `json:"expire"`
		}

		err := json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		if id != request.UserId {
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
			return
		}

		product := database.Product{
			UserId: request.UserId,
			Name:   request.Name,
			Expire: request.Expire,
		}

		err = productRepository.CreateProduct(&product)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(map[string]string{"message": "Product created successfully!"})
		if err != nil {
			return
		}
	}
}

func deleteProductHandler(productRepository *database.ProductRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}

		id, ok := sessionManager.Get(r.Context(), "id").(int)
		if !ok {
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
			return
		}

		var request struct {
			Id int `json:"id"`
		}

		err := json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		product, err := productRepository.GetProductById(request.Id, id)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		if product.UserId != id {
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
			return
		}

		err = productRepository.DeleteProduct(request.Id, id)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(map[string]string{"message": "Product deleted successfully!"})
		if err != nil {
			return
		}
	}
}

func updateProductHandler(productRepository *database.ProductRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}

		id, ok := sessionManager.Get(r.Context(), "id").(int)
		if !ok {
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
			return
		}

		var request struct {
			Id       int       `json:"id"`
			Name     string    `json:"name"`
			Expire   time.Time `json:"expire"`
			Position int       `json:"position"`
		}

		err := json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		product := database.Product{
			Id:       request.Id,
			UserId:   id,
			Name:     request.Name,
			Expire:   request.Expire,
			Position: request.Position,
		}

		err = productRepository.UpdateProduct(&product, id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
				return
			}
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(map[string]string{"message": "Product updated successfully!"})
	}
}

func createProductByBarcodeHandler(productRepository *database.ProductRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		}

		id, ok := sessionManager.Get(r.Context(), "id").(int)
		if !ok {
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		}

		var request struct {
			Barcode string    `json:"barcode"`
			Expire  time.Time `json:"expire"`
		}

		err := json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		url := fmt.Sprintf(openFoodFactsURL, request.Barcode, "?fields=product_name")

		resp, err := http.Get(url)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		defer func(Body io.ReadCloser) {
			err := Body.Close()
			if err != nil {
				http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
				return
			}
		}(resp.Body)

		if resp.StatusCode != http.StatusOK {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		var apiResponse ApiResponse
		err = json.NewDecoder(resp.Body).Decode(&apiResponse)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		if apiResponse.Status != 1 {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		product := database.Product{
			UserId: id,
			Name:   apiResponse.Product.ProductName,
			Expire: request.Expire,
		}

		err = productRepository.CreateProduct(&product)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(map[string]string{"message": "Product created successfully!"})
	}
}

func createApiKeyHandler(apiRepository *database.ApiRepository) http.HandlerFunc {
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

		key, err := apiRepository.CreateKey(id)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(map[string]string{"key": key})
	}
}

func getProductsWithKeyHandler(productRepository *database.ProductRepository, apiRepository *database.ApiRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}

		var request struct {
			Key string `json:"key"`
		}

		err := json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		userId, err := apiRepository.GetUserId(request.Key)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		products, err := productRepository.GetProducts(userId)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(products)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}
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

	frontendFS, err := fs.Sub(smartfridgeApp, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	dbConnection, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}

	sessionManager = scs.New()
	sessionManager.Store = postgresstore.New(dbConnection)
	sessionManager.Lifetime = 24 * time.Hour
	sessionManager.Cookie.HttpOnly = true
	sessionManager.Cookie.Secure = isHTTPS
	sessionManager.Cookie.SameSite = http.SameSiteLaxMode

	sessionRepository := database.SessionRepository{Db: dbConnection}

	err = sessionRepository.CreateTable()
	if err != nil {
		return
	}

	dbConnection.SetMaxOpenConns(25)
	dbConnection.SetMaxIdleConns(10)
	dbConnection.SetConnMaxLifetime(5 * time.Minute)

	defer func(dbConnection *sql.DB) {
		err := dbConnection.Close()
		if err != nil {
			log.Printf("Error closing db connection: %s\n", err)
		}
	}(dbConnection)

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

	apiRepository := &database.ApiRepository{Db: dbConnection}
	err = apiRepository.CreateTable()
	if err != nil {
		log.Fatal(err)
	}

	http.Handle("/api/create_user", createUserHandler(userRepository))
	http.Handle("/api/login", loginHandler(userRepository))
	http.Handle("/api/me", meHandler(userRepository))
	http.Handle("/api/get_products", getProductsHandler(productRepository))
	http.Handle("/api/create_product", createProductHandler(productRepository))
	http.Handle("/api/delete_product", deleteProductHandler(productRepository))
	http.Handle("/api/update_product", updateProductHandler(productRepository))
	http.Handle("/api/create_product_barcode", createProductByBarcodeHandler(productRepository))
	http.Handle("/api/create_key", createApiKeyHandler(apiRepository))
	http.Handle("/api/get_products_with_key", getProductsWithKeyHandler(productRepository, apiRepository))

	http.Handle("/", http.FileServer(spaFileSystem{http.FS(frontendFS)}))

	port := os.Getenv("PORT")

	if port == "" {
		port = defaultPort
	}

	ip := GetOutboundIP()

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      sessionManager.LoadAndSave(http.DefaultServeMux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	log.Printf("SmartFridge running on http://localhost:%s and http://%s:%s", port, ip, port)
	log.Fatal(srv.ListenAndServe())
}
