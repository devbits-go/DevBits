package handlers

import (
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"backend/api/internal/database"
	"backend/api/internal/logger"

	"github.com/gin-gonic/gin"
)

func UpdateProfilePicture(context *gin.Context) {
	username := context.Param("username")

	existingUser, err := database.GetUserByUsername(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error fetching user: %v", err))
		return
	}
	if existingUser == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("User with name '%v' not found", username))
		return
	}

	oldPicture := strings.TrimSpace(existingUser.Picture)

	ct := context.Request.Header.Get("Content-Type")
	if ct == "" || !strings.Contains(strings.ToLower(ct), "multipart/form-data") {
		logger.Log.WithFields(map[string]interface{}{
			"content_type":   ct,
			"content_length": context.Request.ContentLength,
		}).Warn("UpdateProfilePicture rejected – expected multipart/form-data")
		context.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "Content-Type must be multipart/form-data",
		})
		return
	}

	file, err := context.FormFile("file")
	if err != nil {
		file, err = context.FormFile("picture")
		if err != nil {
			file, err = context.FormFile("image")
			if err != nil {
				logger.Log.WithFields(map[string]interface{}{
					"content_type":   ct,
					"content_length": context.Request.ContentLength,
					"error":          err.Error(),
				}).Warn("UpdateProfilePicture missing file")
				context.JSON(http.StatusBadRequest, gin.H{
					"error":   "Bad Request",
					"message": fmt.Sprintf("Missing profile picture file: %v", err),
				})
				return
			}
		}
	}

	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to prepare upload directory")
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		if file.Header.Get("Content-Type") != "" {
			if guessed, guessErr := mime.ExtensionsByType(file.Header.Get("Content-Type")); guessErr == nil && len(guessed) > 0 {
				ext = guessed[0]
			}
		}
	}

	randomName, err := randomHex(12)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to generate filename")
		return
	}

	filename := buildManagedUploadFilename(context, randomName, ext)
	storedPath := filepath.Join(uploadDir, filename)
	if err := context.SaveUploadedFile(file, storedPath); err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to store profile picture")
		return
	}

	existingUser.Picture = fmt.Sprintf("/%s/%s", uploadDir, filename)
	if err := database.UpdateUser(existingUser); err != nil {
		_ = os.Remove(storedPath)
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error updating user: %v", err))
		return
	}

	cleanupReplacedProfileUpload(oldPicture, existingUser.Picture)

	context.JSON(http.StatusOK, gin.H{
		"message": "Profile picture updated successfully.",
		"user":    existingUser,
	})
}
