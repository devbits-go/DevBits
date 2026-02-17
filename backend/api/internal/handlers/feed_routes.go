package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"backend/api/internal/database"
	"backend/api/internal/types"
	"github.com/gin-gonic/gin"
)

func normalizeFeedSort(sort string) string {
	switch strings.ToLower(strings.TrimSpace(sort)) {
	case "likes", "popular":
		return "popular"
	case "hot":
		return "hot"
	case "new", "recent", "time", "":
		return "recent"
	default:
		return ""
	}
}

// GetPostsFeed handles GET requests to retrieve a set of posts for the feed
// It expects the URL parameters of `type`, `start`, and `count`
// Returns:
// - 400 Bad Request if the inputs are invalid.
// - 404 Not Found if the post does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the post feed in JSON format.
func GetPostsFeed(context *gin.Context) {
	feedType := context.Query("type")
	feedSort := context.Query("sort")
	strStart := context.Query("start")
	strCount := context.Query("count")

	const maxCount = 50

	if strStart == "" || strCount == "" {
		RespondWithError(context, http.StatusBadRequest, "Missing one or more required url query parameters: type, start, or count")
		return
	}

	if feedSort == "" {
		feedSort = feedType
	}
	feedSort = normalizeFeedSort(feedSort)
	if feedSort == "" {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Invalid feed sort passed: %v", feedType))
		return
	}

	start, err := strconv.Atoi(strStart)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse starting int: %v", err))
		return
	}
	if start < 0 {
		RespondWithError(context, http.StatusBadRequest, "Start must be 0 or greater")
		return
	}

	count, err := strconv.Atoi(strCount)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse count int: %v", err))
		return
	}
	if count <= 0 {
		RespondWithError(context, http.StatusBadRequest, "Count must be greater than 0")
		return
	}
	if count > maxCount {
		count = maxCount
	}
	var posts []types.Post = []types.Post{}
	var code int
	posts, code, err = database.GetPostFeedBySort(start, count, feedSort)
	if err != nil {
		RespondWithError(context, code, fmt.Sprintf("An error occurred getting feed: %v", err))
		return
	}
	context.JSON(http.StatusOK, posts)
}

// GetProjectsFeed handles GET requests to retrieve a set of projects for the feed
// It expects the URL parameters of `type`, `start`, and `count`
// Returns:
// - 400 Bad Request if the inputs are invalid.
// - 404 Not Found if the post does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the post feed in JSON format.
func GetProjectsFeed(context *gin.Context) {
	feedType := context.Query("type")
	feedSort := context.Query("sort")
	strStart := context.Query("start")
	strCount := context.Query("count")

	const maxCount = 50

	if strStart == "" || strCount == "" {
		RespondWithError(context, http.StatusBadRequest, "Missing one or more required url query parameters: type, start, or count")
		return
	}

	if feedSort == "" {
		feedSort = feedType
	}
	feedSort = normalizeFeedSort(feedSort)
	if feedSort == "" {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Invalid feed sort passed: %v", feedType))
		return
	}

	start, err := strconv.Atoi(strStart)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse starting int: %v", err))
		return
	}
	if start < 0 {
		RespondWithError(context, http.StatusBadRequest, "Start must be 0 or greater")
		return
	}

	count, err := strconv.Atoi(strCount)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse count int: %v", err))
		return
	}
	if count <= 0 {
		RespondWithError(context, http.StatusBadRequest, "Count must be greater than 0")
		return
	}
	if count > maxCount {
		count = maxCount
	}
	var projects []types.Project = []types.Project{}
	var code int
	projects, code, err = database.GetProjectFeedBySort(start, count, feedSort)
	if err != nil {
		RespondWithError(context, code, fmt.Sprintf("An error occurred getting feed: %v", err))
		return
	}
	context.JSON(http.StatusOK, projects)
}

func parseFeedPagination(context *gin.Context) (int, int, bool) {
	strStart := context.Query("start")
	strCount := context.Query("count")
	const maxCount = 50

	if strStart == "" || strCount == "" {
		RespondWithError(context, http.StatusBadRequest, "Missing one or more required url query parameters: start or count")
		return 0, 0, false
	}

	start, err := strconv.Atoi(strStart)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse starting int: %v", err))
		return 0, 0, false
	}
	if start < 0 {
		RespondWithError(context, http.StatusBadRequest, "Start must be 0 or greater")
		return 0, 0, false
	}

	count, err := strconv.Atoi(strCount)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse count int: %v", err))
		return 0, 0, false
	}
	if count <= 0 {
		RespondWithError(context, http.StatusBadRequest, "Count must be greater than 0")
		return 0, 0, false
	}
	if count > maxCount {
		count = maxCount
	}

	return start, count, true
}

func GetFollowingPostsFeed(context *gin.Context) {
	username := context.Param("username")
	sort := normalizeFeedSort(context.DefaultQuery("sort", "recent"))
	if sort == "" {
		RespondWithError(context, http.StatusBadRequest, "Invalid sort; expected one of: recent, new, popular, likes, hot")
		return
	}
	start, count, ok := parseFeedPagination(context)
	if !ok {
		return
	}

	posts, code, err := database.GetPostByFollowingFeed(username, start, count, sort)
	if err != nil {
		RespondWithError(context, code, fmt.Sprintf("An error occurred getting following posts feed: %v", err))
		return
	}

	context.JSON(http.StatusOK, posts)
}

func GetSavedPostsFeed(context *gin.Context) {
	username := context.Param("username")
	sort := normalizeFeedSort(context.DefaultQuery("sort", "recent"))
	if sort == "" {
		RespondWithError(context, http.StatusBadRequest, "Invalid sort; expected one of: recent, new, popular, likes, hot")
		return
	}
	start, count, ok := parseFeedPagination(context)
	if !ok {
		return
	}

	posts, code, err := database.GetPostBySavedFeed(username, start, count, sort)
	if err != nil {
		RespondWithError(context, code, fmt.Sprintf("An error occurred getting saved posts feed: %v", err))
		return
	}

	context.JSON(http.StatusOK, posts)
}

func GetFollowingProjectsFeed(context *gin.Context) {
	username := context.Param("username")
	sort := normalizeFeedSort(context.DefaultQuery("sort", "recent"))
	if sort == "" {
		RespondWithError(context, http.StatusBadRequest, "Invalid sort; expected one of: recent, new, popular, likes, hot")
		return
	}
	start, count, ok := parseFeedPagination(context)
	if !ok {
		return
	}

	projects, code, err := database.GetProjectByFollowingFeed(username, start, count, sort)
	if err != nil {
		RespondWithError(context, code, fmt.Sprintf("An error occurred getting following projects feed: %v", err))
		return
	}

	context.JSON(http.StatusOK, projects)
}

func GetSavedProjectsFeed(context *gin.Context) {
	username := context.Param("username")
	sort := normalizeFeedSort(context.DefaultQuery("sort", "recent"))
	if sort == "" {
		RespondWithError(context, http.StatusBadRequest, "Invalid sort; expected one of: recent, new, popular, likes, hot")
		return
	}
	start, count, ok := parseFeedPagination(context)
	if !ok {
		return
	}

	projects, code, err := database.GetProjectBySavedFeed(username, start, count, sort)
	if err != nil {
		RespondWithError(context, code, fmt.Sprintf("An error occurred getting saved projects feed: %v", err))
		return
	}

	context.JSON(http.StatusOK, projects)
}
