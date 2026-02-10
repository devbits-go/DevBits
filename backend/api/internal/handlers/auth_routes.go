package handlers

import (
	"fmt"
	"net/http"

	"backend/api/internal/auth"
	"backend/api/internal/database"
	"backend/api/internal/types"

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
	Token string     `json:"token"`
	User  types.User `json:"user"`
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

	existing, err := database.QueryUsername(request.Username)
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

	newUser := &types.User{
		Username: request.Username,
		Bio:      request.Bio,
		Links:    request.Links,
		Picture:  request.Picture,
	}

	createdUser, err := database.QueryCreateUserWithLogin(newUser, string(passwordHash))
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to create user: %v", err))
		return
	}

	token, err := auth.GenerateToken(createdUser.ID, createdUser.Username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to issue token")
		return
	}

	context.JSON(http.StatusCreated, AuthResponse{Token: token, User: *createdUser})
}

func Login(context *gin.Context) {
	var request LoginRequest
	if err := context.BindJSON(&request); err != nil {
		RespondWithError(context, http.StatusBadRequest, "Invalid login request")
		return
	}

	storedHash, err := database.QueryGetPasswordHash(request.Username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to login: %v", err))
		return
	}
	if storedHash == "" {
		RespondWithError(context, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(request.Password)); err != nil {
		RespondWithError(context, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	user, err := database.QueryUsername(request.Username)
	if err != nil || user == nil {
		RespondWithError(context, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Username)
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

	user, err := database.QueryUsername(username)
	if err != nil || user == nil {
		RespondWithError(context, http.StatusUnauthorized, "Unauthorized")
		return
	}

	context.JSON(http.StatusOK, user)
}
