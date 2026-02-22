package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"backend/api/internal/auth"
	"backend/api/internal/database"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	Username string   `json:"username" binding:"required"`
	Password string   `json:"password" binding:"required"`
	Bio      string   `json:"bio"`
	Links    []string `json:"links"`
	Picture  string   `json:"picture"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token string           `json:"token"`
	User  database.ApiUser `json:"user"`
}

func Register(context *gin.Context) {
	var request RegisterRequest
	if err := context.BindJSON(&request); err != nil {
		RespondWithError(context, http.StatusBadRequest, "Invalid register request")
		return
	}

	if len(request.Password) < 6 {
		RespondWithError(context, http.StatusBadRequest, "Password must be at least 6 characters")
		return
	}

	existing, err := database.GetUserByUsername(request.Username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to check user")
		return
	}
	if existing != nil {
		RespondWithError(context, http.StatusConflict, "Username already taken")
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to secure password")
		return
	}

	newUser := &database.ApiUser{
		Username: request.Username,
		Bio:      request.Bio,
		Links:    map[string]interface{}{}, // Initialize empty map
		Picture:  request.Picture,
		Settings: map[string]interface{}{}, // Initialize empty map
	}

	if strings.TrimSpace(newUser.Picture) != "" {
		storedPicture, err := materializeMediaReference(newUser.Picture)
		if err != nil {
			RespondWithError(context, http.StatusBadRequest, "Invalid picture media reference")
			return
		}
		newUser.Picture = storedPicture
	}

	// Convert links slice to map
	if request.Links != nil {
		linksMap := make(map[string]interface{})
		for i, link := range request.Links {
			linksMap[fmt.Sprintf("link%d", i+1)] = link
		}
		newUser.Links = linksMap
	}

	id, err := database.CreateUser(newUser)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to create user: %v", err))
		return
	}
	newUser.Id = id

	loginInfo := &database.UserLoginInfo{
		Username:     request.Username,
		PasswordHash: string(passwordHash),
	}
	err = database.CreateUserLoginInfo(loginInfo)
	if err != nil {
		// Consider rolling back user creation
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to create login info: %v", err))
		return
	}

	token, err := auth.GenerateToken(int64(newUser.Id), newUser.Username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to issue token")
		return
	}

	context.JSON(http.StatusCreated, AuthResponse{Token: token, User: *newUser})
}

func Login(context *gin.Context) {
	var request LoginRequest
	if err := context.BindJSON(&request); err != nil {
		RespondWithError(context, http.StatusBadRequest, "Invalid login request")
		return
	}

	loginInfo, err := database.GetUserLoginInfo(request.Username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to login: %v", err))
		return
	}
	if loginInfo == nil {
		RespondWithError(context, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(loginInfo.PasswordHash), []byte(request.Password)); err != nil {
		RespondWithError(context, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	user, err := database.GetUserByUsername(request.Username)
	if err != nil || user == nil {
		RespondWithError(context, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	token, err := auth.GenerateToken(int64(user.Id), user.Username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to issue token")
		return
	}

	context.JSON(http.StatusOK, AuthResponse{Token: token, User: *user})
}

func GetMe(context *gin.Context) {
	username := context.GetString(authUsernameKey)
	if username == "" {
		RespondWithError(context, http.StatusUnauthorized, "Unauthorized")
		return
	}

	user, err := database.GetUserByUsername(username)
	if err != nil || user == nil {
		RespondWithError(context, http.StatusUnauthorized, "Unauthorized")
		return
	}

	context.JSON(http.StatusOK, user)
}
