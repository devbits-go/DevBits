package main

import (
	"log"
	"os"

	"backend/api/internal/database"
	"backend/api/internal/handlers"
	"backend/api/internal/logger"

	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
)

const DEBUG bool = true

func HealthCheck(context *gin.Context) {
    context.JSON(200, gin.H{"message": "API is running!"})
}

func main() {
	logger.InitLogger()

	router := gin.Default()
	router.HandleMethodNotAllowed = true

    router.GET("/health", HealthCheck)

	router.GET("/users/:username", handlers.GetUserByUsername)
    router.POST("/users", handlers.CreateUser)
	router.PUT("/users/:username", handlers.UpdateUserInfo)
	router.DELETE("/users/:username", handlers.DeleteUser)

	router.GET("/users/:username/followers", handlers.GetUsersFollowers)
	router.GET("/users/:username/follows", handlers.GetUsersFollowing)
	router.GET("/users/:username/followers/usernames", handlers.GetUsersFollowersUsernames)
	router.GET("/users/:username/follows/usernames", handlers.GetUsersFollowingUsernames)
    router.POST("users/:username/add_follower/:new_follow", handlers.FollowUser)

    router.GET("/projects/:id", handlers.GetProjectById)
    router.POST("/projects", handlers.CreateProject)
	router.PUT("/projects/:id", handlers.UpdateProjectInfo)
    router.DELETE("/projects/:id", handlers.DeleteProject)

	var dbinfo, dbtype string
	if DEBUG {
		dbinfo = "./api/internal/database/dev.sqlite3"
		dbtype = "sqlite3"
	} else {
		dbinfo = os.Getenv("DB_INFO")
		dbtype = os.Getenv("DB_TYPE")
		if dbinfo == "" {
			log.Fatalln("FATAL: debug mode is false and 'DB_INFO' doesn't exist!")
		}
		if dbtype == "" {
			log.Fatalln("FATAL: debug mode is false and 'DB_TYPE' doesn't exist!")
		}
	}
	database.Connect(dbinfo, dbtype)

	router.Run("localhost:8080")
}
