// The test package includes all of the functionality to 
// test the api in any way we see fit.
//
// it uses all of the packages, along with the 
// testing and assert packages to ensure that the tests are
// properly ran effectively and return the correct results
package tests

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	_ "modernc.org/sqlite"
)

type TestCase struct {
	Method         string
	Endpoint       string
	Input          string
	ExpectedStatus int
	ExpectedBody   string
}

var main_tests []TestCase = []TestCase{
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

func ResetTestDatabase(db *sql.DB) error {
	files := []string{
		"../database/create_tables.sql",
		"../database/create_test_data.sql",
	}

	for _, file := range files {
		sqlBytes, err := os.ReadFile(file)
		if err != nil {
			return fmt.Errorf("failed to read file %s: %v", file, err)
		}

		_, err = db.Exec(string(sqlBytes))
		if err != nil {
			return fmt.Errorf("failed to execute SQL from file %s: %v", file, err)
		}
	}

	fmt.Println("Test database reset successfully.")
	return nil
}

func (tc *TestCase) Run(t *testing.T) {
	t.Helper() // Mark this function as a test helper

	url := "http://localhost:8080" + tc.Endpoint
	var req *http.Request
	var err error

	// set the request body if it is provided
	if tc.Input != "" {
		req, err = http.NewRequest(tc.Method, url, bytes.NewBufferString(tc.Input))
	} else {
		req, err = http.NewRequest(tc.Method, url, nil)
	}
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

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

	// check if the response is expected to be JSON
	if resp.Header.Get("Content-Type") == "application/json" {
		// try to parse response JSON
		var actualJSON map[string]interface{}
		if err := json.Unmarshal(body, &actualJSON); err != nil {
			t.Fatalf("Expected valid JSON response but got invalid JSON. Body: %q, Error: %v", body, err)
		}

		// parse the expected JSON
		var expectedJSON map[string]interface{}
		if err := json.Unmarshal([]byte(tc.ExpectedBody), &expectedJSON); err != nil {
			t.Fatalf("Test has invalid ExpectedBody JSON: %q, Error: %v", tc.ExpectedBody, err)
		}

		assert.Equal(t, expectedJSON, actualJSON, "Response body mismatch for %s %s", tc.Method, tc.Endpoint)
	} else {
		assert.Equal(t, tc.ExpectedBody, string(body), "Response body mismatch for %s %s", tc.Method, tc.Endpoint)
	}
}

func TestAPI(t *testing.T) {
	tests := map[string][]TestCase{
		"Main Tests":    main_tests,
		"User Tests":    user_tests,
		"Project Tests": project_tests,
		"Comment Tests": comment_tests,
		"Post Tests":    post_tests,
	}

    db, err := sql.Open("sqlite3", "../database/dev.sqlite3")
	if err != nil {
		panic(fmt.Sprintf("Failed to connect to database: %v", err))
	}
	defer db.Close()

	err = ResetTestDatabase(db)
	if err != nil {
		panic(fmt.Sprintf("Database reset failed: %v", err))
	}

	// iterate through categories and run tests in parallel within each category
	for category, testCases := range tests {
		t.Run(category, func(t *testing.T) {
            t.Parallel() // run the test in parallel
			for _, test := range testCases {
				t.Run(test.Method+" "+test.Endpoint, func(t *testing.T) {
					test.Run(t)
				})
			}
		})
	}
}
