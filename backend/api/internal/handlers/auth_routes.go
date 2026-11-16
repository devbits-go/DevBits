package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

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

type loginFailureState struct {
	failures     int
	firstFailure time.Time
	blockedUntil time.Time
}

var loginFailureMu sync.Mutex
var loginFailuresByKey = make(map[string]loginFailureState)

const (
	loginFailureWindow     = 10 * time.Minute
	loginFailureBlockFor   = 5 * time.Minute
	maxLoginFailuresByUser = 8
	maxLoginFailuresByIP   = 20
)

func loginUserKey(username string) string {
	normalized := strings.ToLower(strings.TrimSpace(username))
	if normalized == "" {
		normalized = "_"
	}
	return "user:" + normalized
}

func loginIPKey(ip string) string {
	normalized := strings.TrimSpace(ip)
	if normalized == "" {
		normalized = "unknown"
	}
	return "ip:" + normalized
}

func resetLoginFailureLocked(key string, now time.Time) {
	state := loginFailuresByKey[key]
	if state.failures == 0 && state.blockedUntil.IsZero() {
		return
	}
	if now.Sub(state.firstFailure) > loginFailureWindow {
		delete(loginFailuresByKey, key)
		return
	}
	state.failures = 0
	state.firstFailure = time.Time{}
	state.blockedUntil = time.Time{}
	loginFailuresByKey[key] = state
}

func checkLoginRateLimit(ip, username string) (bool, int) {
	now := time.Now()
	keys := []string{loginUserKey(username), loginIPKey(ip)}

	loginFailureMu.Lock()
	defer loginFailureMu.Unlock()

	for _, key := range keys {
		state, ok := loginFailuresByKey[key]
		if !ok {
			continue
		}
		if !state.blockedUntil.IsZero() {
			if now.Before(state.blockedUntil) {
				remaining := int(time.Until(state.blockedUntil).Seconds())
				if remaining < 1 {
					remaining = 1
				}
				return true, remaining
			}
			state.blockedUntil = time.Time{}
			state.failures = 0
			state.firstFailure = time.Time{}
			loginFailuresByKey[key] = state
		}
	}

	return false, 0
}

func recordLoginFailure(ip, username string) {
	now := time.Now()
	keys := []string{loginUserKey(username), loginIPKey(ip)}

	loginFailureMu.Lock()
	defer loginFailureMu.Unlock()

	for _, key := range keys {
		state := loginFailuresByKey[key]
		if state.firstFailure.IsZero() || now.Sub(state.firstFailure) > loginFailureWindow {
			state = loginFailureState{failures: 0, firstFailure: now}
		}

		state.failures++
		limit := maxLoginFailuresByIP
		if strings.HasPrefix(key, "user:") {
			limit = maxLoginFailuresByUser
		}
		if state.failures >= limit {
			state.blockedUntil = now.Add(loginFailureBlockFor)
		}

		loginFailuresByKey[key] = state
	}
}

func clearLoginFailures(ip, username string) {
	now := time.Now()
	keys := []string{loginUserKey(username), loginIPKey(ip)}

	loginFailureMu.Lock()
	defer loginFailureMu.Unlock()

	for _, key := range keys {
		resetLoginFailureLocked(key, now)
	}
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
		Links:    []string{},
		Picture:  request.Picture,
		Settings: map[string]interface{}{},
	}

	if strings.TrimSpace(newUser.Picture) != "" {
		storedPicture, err := materializeMediaReference(newUser.Picture)
		if err != nil {
			RespondWithError(context, http.StatusBadRequest, "Invalid picture media reference")
			return
		}
		newUser.Picture = storedPicture
	}

	if request.Links != nil {
		newUser.Links = request.Links
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

	if blocked, retryAfter := checkLoginRateLimit(context.ClientIP(), request.Username); blocked {
		context.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
		RespondWithError(context, http.StatusTooManyRequests, "Too many login attempts. Please try again later.")
		return
	}

	loginInfo, err := database.GetUserLoginInfo(request.Username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to login: %v", err))
		return
	}
	if loginInfo == nil {
		recordLoginFailure(context.ClientIP(), request.Username)
		RespondWithError(context, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(loginInfo.PasswordHash), []byte(request.Password)); err != nil {
		recordLoginFailure(context.ClientIP(), request.Username)
		RespondWithError(context, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	user, err := database.GetUserByUsername(request.Username)
	if err != nil || user == nil {
		recordLoginFailure(context.ClientIP(), request.Username)
		RespondWithError(context, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	activeBan, err := database.GetActiveBanByUserID(int64(user.Id))
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to verify account status")
		return
	}
	if activeBan != nil {
		remainingSeconds := int(time.Until(activeBan.BannedUntil).Seconds())
		if remainingSeconds < 0 {
			remainingSeconds = 0
		}
		context.JSON(http.StatusForbidden, gin.H{
			"error":             "Account banned",
			"message":           "Your account is temporarily banned.",
			"reason":            activeBan.Reason,
			"banned_until":      activeBan.BannedUntil.UTC().Format(time.RFC3339),
			"seconds_remaining": remainingSeconds,
		})
		return
	}

	token, err := auth.GenerateToken(int64(user.Id), user.Username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to issue token")
		return
	}

	clearLoginFailures(context.ClientIP(), request.Username)

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
