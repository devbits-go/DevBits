package handlers

import (
	"net/http"
	"strings"

	"backend/api/internal/auth"

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

func RequireSameUser() gin.HandlerFunc {
	return func(context *gin.Context) {
		paramUsername := context.Param("username")
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

		if paramUsername != authUsername.(string) {
			RespondWithError(context, http.StatusForbidden, "Forbidden")
			context.Abort()
			return
		}

		context.Next()
	}
}
