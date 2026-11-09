//go:build ignore

package main

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"

	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load(".env")
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	rawHost := os.Getenv("HOST")
	hosts := strings.Split(rawHost, ",")

	for _, host := range hosts {
		cmd := exec.Command("keydb-cli", "-h", "127.0.0.1", "-p", "6379", "replicaof", host, "6379")

		var stdout, stderr bytes.Buffer
		cmd.Stdout = &stdout
		cmd.Stderr = &stderr

		err := cmd.Run()
		if err != nil {
			log.Println("cmd.Run() failed with %s\n", err)
		}

		fmt.Printf("Ergebnis (Stdout):\n%s\n", stdout.String())
	}
}
