package handlers

import (
	"net"
	"net/http"
	"os"
	"strings"

	"backend/api/internal/auth"
	"backend/api/internal/database"

	"github.com/gin-gonic/gin"
)

const authUserIDKey = "authUserID"
const authUsernameKey = "authUsername"

func RequireAuth() gin.HandlerFunc {
	return func(context *gin.Context) {
		authorization := context.GetHeader("Authorization")
		if authorization == "" || !strings.HasPrefix(authorization, "Bearer ") {
			RespondWithError(context, http.StatusUnauthorized, "Missing auth token")
			context.Abort()
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer "))
		claims, err := auth.ParseToken(token)
		if err != nil {
			RespondWithError(context, http.StatusUnauthorized, "Invalid auth token")
			context.Abort()
			return
		}

		context.Set(authUserIDKey, claims.UserID)
		context.Set(authUsernameKey, claims.Username)
		context.Next()
	}
}

func RequireAdmin() gin.HandlerFunc {
	return func(context *gin.Context) {
		adminKey := os.Getenv("DEVBITS_ADMIN_KEY")
		provided := context.GetHeader("X-Admin-Key")
		if adminKey != "" && provided != "" && provided == adminKey {
			context.Set("adminAuthMode", "key")
			context.Next()
			return
		}

		authorization := context.GetHeader("Authorization")
		if authorization == "" || !strings.HasPrefix(authorization, "Bearer ") {
			RespondWithError(context, http.StatusUnauthorized, "Admin authentication required")
			context.Abort()
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer "))
		claims, err := auth.ParseToken(token)
		if err != nil {
			RespondWithError(context, http.StatusUnauthorized, "Invalid admin token")
			context.Abort()
			return
		}

		isAdmin, err := database.IsUserAdmin(claims.UserID)
		if err != nil {
			RespondWithError(context, http.StatusInternalServerError, "Failed to verify admin privileges")
			context.Abort()
			return
		}
		if !isAdmin {
			RespondWithError(context, http.StatusForbidden, "Admin privileges required")
			context.Abort()
			return
		}

		context.Set(authUserIDKey, claims.UserID)
		context.Set(authUsernameKey, claims.Username)
		context.Set("adminAuthMode", "token")

		context.Next()
	}
}

func RequireLocalhost() gin.HandlerFunc {
	return func(context *gin.Context) {
		clientIP := strings.TrimSpace(context.ClientIP())
		parsed := net.ParseIP(clientIP)
		if parsed == nil || !parsed.IsLoopback() {
			RespondWithError(context, http.StatusForbidden, "Admin console is local-only")
			context.Abort()
			return
		}

		context.Next()
	}
}

func RequireSameUser() gin.HandlerFunc {
	return func(context *gin.Context) {
		paramUsername := strings.TrimSpace(context.Param("username"))
		if paramUsername == "" {
			context.Next()
			return
		}

		authUsername, ok := context.Get(authUsernameKey)
		if !ok || authUsername == nil {
			RespondWithError(context, http.StatusUnauthorized, "Auth user missing")
			context.Abort()
			return
		}

		authUsernameValue, ok := authUsername.(string)
		if !ok {
			RespondWithError(context, http.StatusUnauthorized, "Auth user missing")
			context.Abort()
			return
		}

		if !strings.EqualFold(paramUsername, strings.TrimSpace(authUsernameValue)) {
			RespondWithError(context, http.StatusForbidden, "Forbidden")
			context.Abort()
			return
		}

		context.Next()
	}
}
