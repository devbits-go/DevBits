// The test package includes all of the functionality to
// test the api in any way we see fit.
//
// It uses httptest.NewServer so tests run against an in-process server with
// no external network connections, making them quick to start and stable.
package tests

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"backend/api/internal/auth"
	"backend/api/internal/database"
	"backend/api/internal/handlers"
	"backend/api/internal/logger"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/assert"
)

// TestCase describes a single HTTP request/response test.
// Set AuthAs to "username" (or "username:id") to attach a JWT to the request.
type TestCase struct {
	Method         string
	Endpoint       string
	Input          string
	ExpectedStatus int
	ExpectedBody   string
	AuthAs         string // optional: "username" or "username:id"
}

var main_tests = []TestCase{
	{
		Method:         http.MethodGet,
		Endpoint:       "/health",
		Input:          "",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"API is running!"}`,
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/health",
		Input:          `{"test": "data"}`,
		ExpectedStatus: http.StatusMethodNotAllowed,
		ExpectedBody:   `405 method not allowed`,
	},
}

// setupTestRouter builds a gin.Engine with all API routes registered.
// It does NOT start a listener; use httptest.NewServer to serve requests.
func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.HandleMethodNotAllowed = true

	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	router.Use(cors.New(corsConfig))

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "API is running!"})
	})

	router.POST("/auth/register", handlers.Register)
	router.POST("/auth/login", handlers.Login)
	router.GET("/auth/me", handlers.RequireAuth(), handlers.GetMe)

	router.GET("/users", handlers.GetUsers)
	router.GET("/users/search", handlers.SearchUsers)
	router.GET("/users/:username", handlers.GetUserByUsername)
	router.GET("/users/id/:user_id", handlers.GetUserById)
	router.POST("/users", handlers.RequireAuth(), handlers.CreateUser)
	router.PUT("/users/:username", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.UpdateUserInfo)
	router.DELETE("/users/:username", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.DeleteUser)

	router.GET("/users/:username/followers", handlers.GetUsersFollowers)
	router.GET("/users/:username/follows", handlers.GetUsersFollowing)
	router.POST("/users/:username/follow/:new_follow", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.FollowUser)
	router.POST("/users/:username/unfollow/:unfollow", handlers.RequireAuth(), handlers.RequireSameUser(), handlers.UnfollowUser)

	router.GET("/projects/:project_id", handlers.GetProjectById)
	router.POST("/projects", handlers.RequireAuth(), handlers.CreateProject)
	router.PUT("/projects/:project_id", handlers.RequireAuth(), handlers.UpdateProjectInfo)
	router.DELETE("/projects/:project_id", handlers.RequireAuth(), handlers.DeleteProject)
	router.GET("/projects/by-user/:user_id", handlers.GetProjectsByUserId)

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

	return router
}

// loadSQLFile executes all statements from a SQL file on db.
// An optional series of old/new string pairs can be passed to rewrite
// the SQL before execution (e.g. to make PostgreSQL DDL run on SQLite).
func loadSQLFile(db *sql.DB, filename string, replacements ...string) error {
	_, callerFile, _, _ := runtime.Caller(0)
	root := filepath.Dir(filepath.Dir(filepath.Dir(filepath.Dir(callerFile))))
	path := filepath.Join(root, "api", "internal", "database", filename)
	sqlBytes, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read %s: %v", path, err)
	}
	content := string(sqlBytes)
	for i := 0; i+1 < len(replacements); i += 2 {
		content = strings.ReplaceAll(content, replacements[i], replacements[i+1])
	}
	for _, stmt := range strings.Split(content, ";") {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := db.Exec(stmt); err != nil {
			stmtPreview := stmt
			if len(stmtPreview) > 220 {
				stmtPreview = stmtPreview[:220] + "..."
			}
			return fmt.Errorf("failed to exec statement from %s: %v\nstatement: %s", path, err, stmtPreview)
		}
	}
	return nil
}

// Run executes the test case against the given server URL.
func (tc *TestCase) Run(t *testing.T, serverURL string) {
	t.Helper()

	url := serverURL + tc.Endpoint
	var req *http.Request
	var err error

	if tc.Input != "" {
		req, err = http.NewRequest(tc.Method, url, bytes.NewBufferString(tc.Input))
	} else {
		req, err = http.NewRequest(tc.Method, url, nil)
	}
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	if tc.AuthAs != "" {
		parts := strings.SplitN(tc.AuthAs, ":", 2)
		username := parts[0]
		var userID int64 = 99
		if len(parts) == 2 {
			fmt.Sscanf(parts[1], "%d", &userID) //nolint:errcheck
		}
		token, err := auth.GenerateToken(userID, username)
		if err != nil {
			t.Fatalf("Failed to generate auth token: %v", err)
		}
		req.Header.Set("Authorization", "Bearer "+token)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("Failed to send request: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("Failed to read response body: %v", err)
	}

	assert.Equal(t, tc.ExpectedStatus, resp.StatusCode, "Status code mismatch for %s %s", tc.Method, tc.Endpoint)

	// Skip body comparison when ExpectedBody is empty.
	if tc.ExpectedBody == "" {
		return
	}

	if strings.Contains(resp.Header.Get("Content-Type"), "application/json") {
		var actualJSON interface{}
		if err := json.Unmarshal(body, &actualJSON); err != nil {
			t.Fatalf("Expected valid JSON response but got invalid JSON. Body: %q, Error: %v", body, err)
		}
		var expectedJSON interface{}
		if err := json.Unmarshal([]byte(tc.ExpectedBody), &expectedJSON); err != nil {
			t.Fatalf("Test has invalid ExpectedBody JSON: %q, Error: %v", tc.ExpectedBody, err)
		}
		assert.Equal(t, expectedJSON, actualJSON, "Response body mismatch for %s %s", tc.Method, tc.Endpoint)
	} else {
		assert.Equal(t, tc.ExpectedBody, string(body), "Response body mismatch for %s %s", tc.Method, tc.Endpoint)
	}
}

func TestAPI(t *testing.T) {
	logger.InitLogger()

	database.DB = nil
	testDbPath := filepath.Join(t.TempDir(), "api_tests.sqlite3")
	db, err := sql.Open("sqlite", testDbPath)
	if err != nil {
		t.Fatalf("Failed to open test sqlite database: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	if _, err := db.Exec("PRAGMA foreign_keys=ON;"); err != nil {
		t.Fatalf("Failed to enable sqlite foreign keys: %v", err)
	}
	if _, err := db.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		t.Fatalf("Failed to set sqlite WAL mode: %v", err)
	}
	if _, err := db.Exec("PRAGMA busy_timeout=5000;"); err != nil {
		t.Fatalf("Failed to set sqlite busy timeout: %v", err)
	}

	database.DB = db

	if err := loadSQLFile(
		db,
		"create_tables.sql",
		"SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT",
	); err != nil {
		t.Fatalf("Failed to load schema: %v", err)
	}
	if err := loadSQLFile(db, "create_test_data.sql"); err != nil {
		t.Fatalf("Failed to load test data: %v", err)
	}

	if _, err := db.Exec(`INSERT INTO users (id, username, picture, bio, links, settings, creation_date) VALUES (-1, 'deleted_user', '', '', '[]', '{}', '1970-01-01 00:00:00')`); err != nil {
		t.Fatalf("Failed to insert sentinel deleted user: %v", err)
	}

	// Start an in-process HTTP test server — no external daemon needed.
	router := setupTestRouter()
	server := httptest.NewServer(router)
	defer server.Close()

	tests := map[string][]TestCase{
		"Main Tests":    main_tests,
		"User Tests":    user_tests,
		"Project Tests": project_tests,
		"Comment Tests": comment_tests,
		"Post Tests":    post_tests,
	}

	// Run each category sequentially to avoid shared-database race conditions.
	for category, testCases := range tests {
		t.Run(category, func(t *testing.T) {
			for _, tc := range testCases {
				tc := tc
				t.Run(tc.Method+" "+tc.Endpoint, func(t *testing.T) {
					tc.Run(t, server.URL)
				})
			}
		})
	}
}
