package tests

import (
	"net/http"
)

var project_tests = []TestCase{
	// GET by project ID
	{
		Method:         http.MethodGet,
		Endpoint:       "/projects/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"id":1,"owner":1,"name":"OpenAPI Toolkit","description":"A toolkit for generating and testing OpenAPI specs.","status":1,"likes":120,"tags":["OpenAPI","Go","Tooling"],"links":["https://github.com/dev_user1/openapi-toolkit"],"creation_date":"2023-06-13T00:00:00Z"}`,
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
	{
		Method:         http.MethodPost,
		Endpoint:       "/projects",
		Input:          `{"name":"Duplicate Project","description":"Test duplicate","owner":-1}`,
		ExpectedStatus: http.StatusBadRequest,
		ExpectedBody:   `{"error":"Bad Request","message":"Failed to verify project ownership. User could not be found"}`,
		AuthAs:         "dev_user1:1",
	},

	// PUT update project
	{
		Method:         http.MethodPut,
		Endpoint:       "/projects/1",
		Input:          `{"name":"Completely Updated Project","description":"This project has been fully updated.","owner":2,"status":2,"likes":200,"tags":["UpdatedTag1","UpdatedTag2"],"links":["https://updatedlink1.com","https://updatedlink2.com"]}`,
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"Project updated successfully","project":{"id":1,"owner":2,"name":"Completely Updated Project","description":"This project has been fully updated.","status":2,"likes":200,"tags":["UpdatedTag1","UpdatedTag2"],"links":["https://updatedlink1.com","https://updatedlink2.com"],"creation_date":"2023-06-13T00:00:00Z"}}`,
		AuthAs:         "dev_user1:1",
	},

	// update back
	{
		Method:         http.MethodPut,
		Endpoint:       "/projects/1",
		Input:          `{"owner":1,"name":"OpenAPI Toolkit","description":"A toolkit for generating and testing OpenAPI specs.","status":1,"likes":120,"tags":["OpenAPI","Go","Tooling"],"links":["https://github.com/dev_user1/openapi-toolkit"]}`,
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"Project updated successfully","project":{"id":1,"owner":1,"name":"OpenAPI Toolkit","description":"A toolkit for generating and testing OpenAPI specs.","status":1,"likes":120,"tags":["OpenAPI","Go","Tooling"],"links":["https://github.com/dev_user1/openapi-toolkit"],"creation_date":"2023-06-13T00:00:00Z"}}`,
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
	{
		Method:         http.MethodDelete,
		Endpoint:       "/projects/9999",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Failed to delete project: Deletion did not affect any records"}`,
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

	// like / unlike project
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
		ExpectedBody:   `{"id":4,"owner":4,"name":"ScaleDB","description":"A scalable database system for modern apps.","status":1,"likes":71,"tags":["Database","Scalability","Backend"],"links":["https://github.com/backend_guru4/scaledb"],"creation_date":"2024-03-15T00:00:00Z"}`,
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
		ExpectedBody:   `{"id":4,"owner":4,"name":"ScaleDB","description":"A scalable database system for modern apps.","status":1,"likes":70,"tags":["Database","Scalability","Backend"],"links":["https://github.com/backend_guru4/scaledb"],"creation_date":"2024-03-15T00:00:00Z"}`,
	},
}
