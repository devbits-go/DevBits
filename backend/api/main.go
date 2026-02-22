package main

import (
	"log"
	"os"
	"strings"

	"backend/api/internal/database"
	"backend/api/internal/handlers"
	"backend/api/internal/logger"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq" // PostgreSQL driver
	_ "modernc.org/sqlite"
)

const debugEnvKey = "DEVBITS_DEBUG"
const corsOriginsEnvKey = "DEVBITS_CORS_ORIGINS"

func isDebugMode() bool {
	return os.Getenv(debugEnvKey) == "1"
}

func getAllowedOrigins() []string {
	originsCsv := strings.TrimSpace(os.Getenv(corsOriginsEnvKey))
	if originsCsv != "" {
		parts := strings.Split(originsCsv, ",")
		origins := make([]string, 0, len(parts))
		for _, part := range parts {
			origin := strings.TrimSpace(part)
			if origin != "" {
				origins = append(origins, origin)
			}
		}
		if len(origins) > 0 {
			return origins
		}
	}

	return []string{
		"https://devbits.ddns.net",
		"http://localhost:8081",
		"http://localhost:19006",
		"http://127.0.0.1:8081",
		"http://127.0.0.1:19006",
	}
}

func HealthCheck(context *gin.Context) {
	context.JSON(200, gin.H{"message": "API is running!"})
}

func main() {
	if isDebugMode() {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}
	log.SetOutput(os.Stdout)
	logger.InitLogger()

	// Initialize the database connection
	database.Connect()

	router := gin.New()
	router.MaxMultipartMemory = 64 << 20
	router.Use(gin.Logger(), gin.Recovery())
	router.Use(func(context *gin.Context) {
		path := context.Request.URL.Path
		if strings.HasPrefix(path, "/uploads/") {
			// Uploaded media is content-addressed (random hex filenames) so
			// it is safe to aggressively cache on the client.
			context.Header("Cache-Control", "public, max-age=31536000, immutable")
			context.Next()
			return
		}
		if path == "/account-deletion" || path == "/privacy-policy" {
			context.Next()
			return
		}

		context.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		context.Header("Pragma", "no-cache")
		context.Header("Expires", "0")
		context.Next()
	})
	router.HandleMethodNotAllowed = true
	if err := router.SetTrustedProxies([]string{"127.0.0.1", "::1"}); err != nil {
		log.Printf("WARN: could not set trusted proxies: %v", err)
	}

	// Apply CORS middleware to the router
	corsConfig := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}
	if isDebugMode() {
		corsConfig.AllowOriginFunc = func(origin string) bool { return true }
	} else {
		corsConfig.AllowOrigins = getAllowedOrigins()
	}
	router.Use(cors.New(corsConfig))

	router.Static("/uploads", "./uploads")

	router.GET("/", func(c *gin.Context) {
		c.String(200, "Welcome to the DevBits API! Everything is running correctly.")
	})

	router.GET("/health", HealthCheck)

	router.POST("/auth/register", handlers.Register)
	router.POST("/auth/login", handlers.Login)
	router.GET("/auth/me", handlers.RequireAuth(), handlers.GetMe)

	router.POST("/media/upload", handlers.RequireAuth(), handlers.UploadMedia)

	router.GET("/users", handlers.GetUsers)
	router.GET("/users/:username", handlers.GetUserByUsername)
	router.GET("/users/id/:user_id", handlers.GetUserById)
	router.POST("/users", handlers.RequireAuth(), handlers.CreateUser)
	router.PUT("/users/:username", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.UpdateUserInfo)
	router.POST("/users/:username/update", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.UpdateUserInfo)
	router.PUT("/users/:username/profile-picture", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.UpdateProfilePicture)
	router.GET("/users/:username/media", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.GetUserManagedMedia)
	router.DELETE("/users/:username/media", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.DeleteUserManagedMedia)
	router.DELETE("/users/:username", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.DeleteUser)

	router.GET("/users/:username/followers", handlers.GetUsersFollowers)
	router.GET("/users/:username/follows", handlers.GetUsersFollowing)
	router.GET("/users/:username/followers/usernames", handlers.GetUsersFollowersUsernames)
	router.GET("/users/:username/follows/usernames", handlers.GetUsersFollowingUsernames)

	router.POST("/users/:username/follow/:new_follow", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.FollowUser)
	router.POST("/users/:username/unfollow/:unfollow", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.UnfollowUser)

	router.GET("/messages/:username/peers", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.GetDirectChatPeers)
	router.GET("/messages/:username/threads", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.GetDirectMessageThreads)
	router.GET("/messages/:username/with/:other", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.GetDirectMessages)
	router.POST("/messages/:username/with/:other", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.CreateDirectMessage)
	router.GET("/messages/:username/stream", handlers.StreamDirectMessages)

	router.GET("/projects/:project_id", handlers.GetProjectById)
	router.POST("/projects", handlers.RequireAuth(), handlers.CreateProject)
	router.PUT("/projects/:project_id", handlers.RequireAuth(), handlers.UpdateProjectInfo)
	router.DELETE("/projects/:project_id", handlers.RequireAuth(), handlers.DeleteProject)
	router.GET("/projects/by-user/:user_id", handlers.GetProjectsByUserId)
	router.GET("/projects/by-builder/:user_id", handlers.RequireAuth(), handlers.GetProjectsByBuilderId)

	router.GET("/projects/:project_id/builders", handlers.GetProjectBuilders)
	router.POST("/projects/:project_id/builders/:username", handlers.RequireAuth(), handlers.AddProjectBuilder)
	router.DELETE("/projects/:project_id/builders/:username", handlers.RequireAuth(), handlers.RemoveProjectBuilder)

	router.GET("/projects/:project_id/followers", handlers.GetProjectFollowers)
	router.GET("/projects/follows/:username", handlers.GetProjectFollowing)
	router.GET("/projects/:project_id/followers/usernames", handlers.GetProjectFollowersUsernames)
	router.GET("/projects/follows/:username/names", handlers.GetProjectFollowingNames)

	router.POST("/projects/user/:username/follow/:project_id", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.FollowProject)
	router.POST("/projects/user/:username/unfollow/:project_id", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.UnfollowProject)

	router.POST("/projects/user/:username/likes/:project_id", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.LikeProject)
	router.POST("/projects/user/:username/unlikes/:project_id", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.UnlikeProject)
	router.GET("/projects/does-like/:username/:project_id", handlers.IsProjectLiked)

	router.GET("/posts/:post_id", handlers.GetPostById)
	router.POST("/posts", handlers.RequireAuth(), handlers.CreatePost)
	router.PUT("/posts/:post_id", handlers.RequireAuth(), handlers.UpdatePostInfo)
	router.DELETE("/posts/:post_id", handlers.RequireAuth(), handlers.DeletePost)

	router.GET("/posts/by-user/:user_id", handlers.GetPostsByUserId)
	router.GET("/posts/by-project/:project_id", handlers.GetPostsByProjectId)

	router.POST("/posts/:username/likes/:post_id", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.LikePost)
	router.POST("/posts/:username/unlikes/:post_id", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.UnlikePost)
	router.GET("/posts/does-like/:username/:post_id", handlers.IsPostLiked)
	router.POST("/posts/:username/save/:post_id", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.SavePost)
	router.POST("/posts/:username/unsave/:post_id", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.UnsavePost)
	router.GET("/posts/saved/:username", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.GetSavedPosts)

	router.POST("/comments/for-post/:post_id", handlers.RequireAuth(), handlers.CreateCommentOnPost)
	router.POST("/comments/for-project/:project_id", handlers.RequireAuth(), handlers.CreateCommentOnProject)
	router.POST("/comments/for-comment/:comment_id", handlers.RequireAuth(), handlers.CreateCommentOnComment)
	router.GET("/comments/:comment_id", handlers.GetCommentById)
	router.PUT("/comments/:comment_id", handlers.RequireAuth(), handlers.UpdateCommentContent)
	router.DELETE("/comments/:comment_id", handlers.RequireAuth(), handlers.DeleteComment)

	router.GET("/comments/by-user/:user_id", handlers.GetCommentsByUserId)
	router.GET("/comments/by-post/:post_id", handlers.GetCommentsByPostId)
	router.GET("/comments/by-project/:project_id", handlers.GetCommentsByProjectId)
	router.GET("/comments/by-comment/:comment_id", handlers.GetCommentsByCommentId)

	router.POST("/comments/:username/likes/:comment_id", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.LikeComment)
	router.POST("/comments/:username/unlikes/:comment_id", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.UnlikeComment)
	router.GET("/comments/does-like/:username/:comment_id", handlers.IsCommentLiked)
	router.GET("/comments/can-edit/:comment_id", handlers.IsCommentEditable)

	router.GET("/feed/posts", handlers.GetPostsFeed)
	router.GET("/feed/projects", handlers.GetProjectsFeed)
	router.GET("/feed/posts/following/:username", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.GetFollowingPostsFeed)
	router.GET("/feed/posts/saved/:username", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.GetSavedPostsFeed)
	router.GET("/feed/projects/following/:username", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.GetFollowingProjectsFeed)
	router.GET("/feed/projects/saved/:username", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.GetSavedProjectsFeed)

	router.POST("/notifications/push-token", handlers.RequireAuth(), handlers.RegisterPushToken)
	router.GET("/notifications", handlers.RequireAuth(), handlers.GetNotifications)
	router.GET("/notifications/unread-count", handlers.RequireAuth(), handlers.GetNotificationCount)
	router.POST("/notifications/:notification_id/read", handlers.RequireAuth(), handlers.MarkNotificationRead)
	router.DELETE("/notifications/:notification_id", handlers.RequireAuth(), handlers.DeleteNotification)
	router.DELETE("/notifications", handlers.RequireAuth(), handlers.ClearNotifications)

	if err := router.Run("0.0.0.0:8080"); err != nil {
		log.Printf("ERROR: failed to start API server on 0.0.0.0:8080: %v", err)
		if isDebugMode() {
			log.Println("HINT: port 8080 is likely already in use. Stop the existing backend process or run only one launcher.")
		}
		os.Exit(1)
	}
}
