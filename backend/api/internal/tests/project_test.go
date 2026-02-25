package tests

import (
	"net/http"
)

var project_tests = []TestCase{
	// GET by project ID – response now includes about_md, saves, and media fields
	{
		Method:         http.MethodGet,
		Endpoint:       "/projects/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"about_md":"","creation_date":"2023-06-13T00:00:00Z","description":"A toolkit for generating and testing OpenAPI specs.","id":1,"likes":120,"links":["https://github.com/dev_user1/openapi-toolkit"],"media":[],"name":"OpenAPI Toolkit","owner":1,"saves":1,"status":1,"tags":["OpenAPI","Go","Tooling"]}`,
	},
	{
		Method:         http.MethodGet,
		Endpoint:       "/projects/-1",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Project with id '-1' not found"}`,
	},

	// POST create project
	{
		Method:         http.MethodPost,
		Endpoint:       "/projects",
		Input:          `{"name":"New Project","description":"Test project description","owner":1}`,
		ExpectedStatus: http.StatusCreated,
		ExpectedBody:   `{"message":"Project created successfully with id '5'"}`,
		AuthAs:         "dev_user1:1",
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/projects",
		Input:          `{"name":"","description":"Test project description","owner":1}`,
		ExpectedStatus: http.StatusBadRequest,
		ExpectedBody:   `{"error":"Bad Request","message":"Failed to bind to JSON: Key: 'Project.Name' Error:Field validation for 'Name' failed on the 'required' tag"}`,
		AuthAs:         "dev_user1:1",
	},
	// owner=-1 doesn't match auth user (1) so auth check fires first
	{
		Method:         http.MethodPost,
		Endpoint:       "/projects",
		Input:          `{"name":"Duplicate Project","description":"Test duplicate","owner":-1}`,
		ExpectedStatus: http.StatusForbidden,
		ExpectedBody:   `{"error":"Forbidden","message":"Owner does not match auth user"}`,
		AuthAs:         "dev_user1:1",
	},

	// PUT update project – keep owner as 1 to avoid breaking subsequent post-creation tests
	{
		Method:         http.MethodPut,
		Endpoint:       "/projects/1",
		Input:          `{"name":"Completely Updated Project","description":"This project has been fully updated.","owner":1,"status":2,"likes":200,"tags":["UpdatedTag1","UpdatedTag2"],"links":["https://updatedlink1.com","https://updatedlink2.com"]}`,
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"Project updated successfully","project":{"about_md":"","creation_date":"2023-06-13T00:00:00Z","description":"This project has been fully updated.","id":1,"likes":200,"links":["https://updatedlink1.com","https://updatedlink2.com"],"media":[],"name":"Completely Updated Project","owner":1,"saves":1,"status":2,"tags":["UpdatedTag1","UpdatedTag2"]}}`,
		AuthAs:         "dev_user1:1",
	},

	// update back to original
	{
		Method:         http.MethodPut,
		Endpoint:       "/projects/1",
		Input:          `{"owner":1,"name":"OpenAPI Toolkit","description":"A toolkit for generating and testing OpenAPI specs.","status":1,"likes":120,"tags":["OpenAPI","Go","Tooling"],"links":["https://github.com/dev_user1/openapi-toolkit"]}`,
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"Project updated successfully","project":{"about_md":"","creation_date":"2023-06-13T00:00:00Z","description":"A toolkit for generating and testing OpenAPI specs.","id":1,"likes":120,"links":["https://github.com/dev_user1/openapi-toolkit"],"media":[],"name":"OpenAPI Toolkit","owner":1,"saves":1,"status":1,"tags":["OpenAPI","Go","Tooling"]}}`,
		AuthAs:         "dev_user1:1",
	},
	{
		Method:         http.MethodPut,
		Endpoint:       "/projects/4",
		Input:          `{"owner":9999}`,
		ExpectedStatus: http.StatusBadRequest,
		ExpectedBody:   `{"error":"Bad Request","message":"Invalid owner id: 9999"}`,
		AuthAs:         "backend_guru4:4",
	},
	{
		Method:         http.MethodPut,
		Endpoint:       "/projects/9999",
		Input:          `{"name":"Non-existent Project"}`,
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Project with id '9999' not found"}`,
		AuthAs:         "dev_user1:1",
	},

	// DELETE project
	{
		Method:         http.MethodDelete,
		Endpoint:       "/projects/5",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"Project 5 deleted."}`,
		AuthAs:         "dev_user1:1",
	},
	// non-existent project delete now returns a simpler not found message
	{
		Method:         http.MethodDelete,
		Endpoint:       "/projects/9999",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Project with id '9999' not found"}`,
		AuthAs:         "dev_user1:1",
	},

	// follow / unfollow project
	{
		Method:         http.MethodPost,
		Endpoint:       "/projects/user/tech_writer2/follow/2",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"tech_writer2 now follows project 2"}`,
		AuthAs:         "tech_writer2:2",
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/projects/user/tech_writer2/unfollow/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"tech_writer2 unfollowed project 1"}`,
		AuthAs:         "tech_writer2:2",
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/projects/user/tech_writer2/follow/9999",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Failed to add follower: Project with id 9999 does not exist"}`,
		AuthAs:         "tech_writer2:2",
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/projects/user/tech_writer2/unfollow/9999",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Failed to remove follower: Project with id 9999 does not exist"}`,
		AuthAs:         "tech_writer2:2",
	},
	{
		Method:         http.MethodGet,
		Endpoint:       "/projects/1/followers/usernames",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `null`,
	},
	{
		Method:         http.MethodGet,
		Endpoint:       "/projects/2/followers/usernames",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `["dev_user1","tech_writer2"]`,
	},
	{
		Method:         http.MethodGet,
		Endpoint:       "/projects/1/followers",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `null`,
	},
	{
		Method:         http.MethodGet,
		Endpoint:       "/projects/2/followers",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[1,2]`,
	},
	{
		Method:         http.MethodGet,
		Endpoint:       "/projects/follows/tech_writer2",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[2]`,
	},
	{
		Method:         http.MethodGet,
		Endpoint:       "/projects/follows/tech_writer2/names",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `["DocuHelper"]`,
	},

	// like / unlike project – response includes all project fields
	{
		Method:         http.MethodPost,
		Endpoint:       "/projects/user/tech_writer2/likes/4",
		ExpectedStatus: http.StatusCreated,
		ExpectedBody:   `{"message":"tech_writer2 likes project 4"}`,
		AuthAs:         "tech_writer2:2",
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/projects/user/tech_writer2/likes/9999",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Failed to like project: Project with id 9999 does not exist"}`,
		AuthAs:         "tech_writer2:2",
	},
	{
		Method:         http.MethodGet,
		Endpoint:       "/projects/4",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"about_md":"","creation_date":"2024-03-15T00:00:00Z","description":"A scalable database system for modern apps.","id":4,"likes":71,"links":["https://github.com/backend_guru4/scaledb"],"media":[],"name":"ScaleDB","owner":4,"saves":0,"status":1,"tags":["Database","Scalability","Backend"]}`,
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/projects/user/tech_writer2/unlikes/4",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"tech_writer2 unliked project 4"}`,
		AuthAs:         "tech_writer2:2",
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/projects/user/tech_writer2/unlikes/9999",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Failed to unlike project: Project with id 9999 does not exist"}`,
		AuthAs:         "tech_writer2:2",
	},
	{
		Method:         http.MethodGet,
		Endpoint:       "/projects/4",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"about_md":"","creation_date":"2024-03-15T00:00:00Z","description":"A scalable database system for modern apps.","id":4,"likes":70,"links":["https://github.com/backend_guru4/scaledb"],"media":[],"name":"ScaleDB","owner":4,"saves":0,"status":1,"tags":["Database","Scalability","Backend"]}`,
	},
}
