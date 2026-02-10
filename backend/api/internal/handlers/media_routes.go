package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

const uploadDir = "uploads"

func UploadMedia(context *gin.Context) {
	file, err := context.FormFile("file")
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, "Missing file")
		return
	}

	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to prepare upload directory")
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		if file.Header.Get("Content-Type") != "" {
			if guessed, err := mime.ExtensionsByType(file.Header.Get("Content-Type")); err == nil && len(guessed) > 0 {
				ext = guessed[0]
			}
		}
	}

	name, err := randomHex(12)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to generate filename")
		return
	}

	filename := fmt.Sprintf("%s%s", name, ext)
	path := filepath.Join(uploadDir, filename)
	if err := context.SaveUploadedFile(file, path); err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to save file")
		return
	}

	scheme := "http"
	if context.Request.TLS != nil {
		scheme = "https"
	}
	url := fmt.Sprintf("%s://%s/%s/%s", scheme, context.Request.Host, uploadDir, filename)

	context.JSON(http.StatusOK, gin.H{
		"url":         url,
		"filename":    filename,
		"contentType": file.Header.Get("Content-Type"),
		"size":        file.Size,
	})
}

func randomHex(length int) (string, error) {
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
