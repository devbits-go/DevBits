package database

import (
	"database/sql"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"time"

	"backend/api/internal/types"
)

// QueryProject retrieves a project by its ID from the database.
//
// Parameters:
//   - id: The unique identifier of the project to query.
//
// Returns:
//   - *types.Project: The project details if found.
//   - error: An error if the query fails. Returns nil for both if no project exists.
func QueryProject(id int) (*types.Project, error) {
	query := `SELECT id, name, description, status, likes, links, tags, owner, creation_date FROM Projects WHERE id = ?;`
	row := DB.QueryRow(query, id)
	var project types.Project
	var linksJSON, tagsJSON string

	err := row.Scan(
		&project.ID,
		&project.Name,
		&project.Description,
		&project.Status,
		&project.Likes,
		&linksJSON,
		&tagsJSON,
		&project.Owner,
		&project.CreationDate,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if err := UnmarshalFromJSON(linksJSON, &project.Links); err != nil {
		return nil, err
	}
	if err := UnmarshalFromJSON(tagsJSON, &project.Tags); err != nil {
		return nil, err
	}

	return &project, nil
}

// QueryProjectsByUserId retrieves a user's projects by a user ID from the database.
//
// Parameters:
//   - id: The unique identifier of the user to query projects on.
//
// Returns:
//   - *[]types.Project: A list of the projects' details if found.
//   - error: An error if the query fails. Returns nil for both if no project exists.
func QueryProjectsByUserId(userId int) ([]types.Project, int, error) {
	query := `SELECT id, name, description, status, likes, links, tags, owner, creation_date FROM Projects WHERE owner = ?;`
	rows, err := DB.Query(query, userId)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	var projects []types.Project
	defer rows.Close()

	for rows.Next() {
		var project types.Project
		var linksJSON, tagsJSON string
		err := rows.Scan(
			&project.ID,
			&project.Name,
			&project.Description,
			&project.Status,
			&project.Likes,
			&linksJSON,
			&tagsJSON,
			&project.Owner,
			&project.CreationDate,
		)
		if err != nil {
			if err == sql.ErrNoRows {
				return nil, http.StatusOK, nil
			}
			return nil, http.StatusInternalServerError, err
		}

		if err := UnmarshalFromJSON(linksJSON, &project.Links); err != nil {
			return nil, http.StatusBadRequest, err
		}
		if err := UnmarshalFromJSON(tagsJSON, &project.Tags); err != nil {
			return nil, http.StatusBadRequest, err
		}
	}

	return projects, http.StatusOK, nil
}

// QueryCreateProject creates a new project in the database.
//
// Parameters:
//   - proj: The project to be created, containing all necessary fields.
//
// Returns:
//   - int64: The ID of the newly created project.
//   - error: An error if the operation fails.
func QueryCreateProject(proj *types.Project) (int64, error) {
	linksJSON, err := MarshalToJSON(proj.Links)
	if err != nil {
		return -1, err
	}

	tagsJSON, err := MarshalToJSON(proj.Tags)
	if err != nil {
		return -1, err
	}

	currentTime := time.Now().UTC()

	query := `INSERT INTO Projects (name, description, status, links, tags, owner, creation_date)
              VALUES (?, ?, ?, ?, ?, ?, ?);`

	res, err := DB.Exec(query, proj.Name, proj.Description, proj.Status, string(linksJSON), string(tagsJSON), proj.Owner, currentTime)
	if err != nil {
		return -1, fmt.Errorf("Failed to create project '%v': %v", proj.Name, err)
	}

	lastId, err := res.LastInsertId()
	if err != nil {
		return -1, fmt.Errorf("Failed to ensure project was created: %v", err)
	}

	return lastId, nil
}

// QueryDeleteProject deletes a project by its ID.
//
// Parameters:
//   - id: The unique identifier of the project to delete.
//
// Returns:
//   - int16: http status code indicating the result of the operation.
//   - error: An error if the operation fails or no project is found.
func QueryDeleteProject(id int) (int16, error) {
	query := `DELETE from Projects WHERE id=?;`
	res, err := DB.Exec(query, id)
	if err != nil {
		return http.StatusBadRequest, fmt.Errorf("Failed to delete project `%v`: %v", id, err)
	}

	rowsAffected, err := res.RowsAffected()
	if rowsAffected == 0 {
		return http.StatusNotFound, fmt.Errorf("Deletion did not affect any records")
	} else if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to fetch affected rows: %v", err)
	}

	return http.StatusOK, nil
}

// QueryUpdateProject updates an existing project in the database.
//
// Parameters:
//   - id: The unique identifier of the project to update.
//   - updatedData: A map containing the fields to update with their new values.
//
// Returns:
//   - error: An error if the operation fails or no project is found.
func QueryUpdateProject(id int, updatedData map[string]interface{}) error {
	query := `UPDATE Projects SET `
	var args []interface{}

	queryParams, args, err := BuildUpdateQuery(updatedData)
	if err != nil {
		return fmt.Errorf("Error building query: %v", err)
	}

	query += queryParams + " WHERE id = ?"
	args = append(args, id)

	rowsAffected, err := ExecUpdate(query, args...)
	if err != nil {
		return fmt.Errorf("Error executing update query: %v", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("No project found with id `%d` to update", id)
	}

	return nil
}

// QueryGetProjectFollowers retrieves the IDs of a project's followers.
//
// Parameters:
//   - projectID: The unique identifier of the project.
//
// Returns:
//   - []int: A list of user IDs who follow the project.
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the query fails.
func QueryGetProjectFollowers(projectID int) ([]int, int, error) {
	query := `
        SELECT u.id
        FROM Users u
        JOIN ProjectFollows pf ON u.id = pf.user_id
        WHERE pf.project_id = ?`

	return getProjectFollowersOrFollowing(query, projectID)
}

// QueryGetProjectFollowersUsernames retrieves the usernames of a project's followers.
//
// Parameters:
//   - projectID: The unique identifier of the project.
//
// Returns:
//   - []string: A list of usernames of the project's followers.
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the query fails.
func QueryGetProjectFollowersUsernames(projectID int) ([]string, int, error) {
	query := `
        SELECT u.username
        FROM Users u
        JOIN ProjectFollows pf ON u.id = pf.user_id
        WHERE pf.project_id = ?`

	return getProjectFollowersOrFollowingUsernames(query, projectID)
}

// QueryGetProjectFollowing retrieves the project IDs a user is following.
//
// Parameters:
//   - username: The username of the user.
//
// Returns:
//   - []int: A list of project IDs the user is following.
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the query fails.
func QueryGetProjectFollowing(username string) ([]int, int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, 0, fmt.Errorf("Error fetching user id from username: %v", err)
	}

	query := `
        SELECT p.id
        FROM Projects p
        JOIN ProjectFollows pf ON p.id = pf.project_id
        WHERE pf.user_id = ?`

	return getProjectFollowersOrFollowing(query, userID)
}

// QueryGetProjectFollowingNames retrieves the project names a user is following.
//
// Parameters:
//   - username: The username of the user.
//
// Returns:
//   - []string: A list of project names the user is following.
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the query fails.
func QueryGetProjectFollowingNames(username string) ([]string, int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, 0, fmt.Errorf("Error fetching user id from username: %v", err)
	}

	query := `
        SELECT p.name
        FROM Projects p
        JOIN ProjectFollows pf ON p.id = pf.project_id
        WHERE pf.user_id = ?`

	return getProjectFollowersOrFollowingUsernames(query, userID)
}

// getProjectFollowersOrFollowing is a helper function for retrieving follower or following IDs.
//
// Parameters:
//   - query: The SQL query string to execute.
//   - userID: The unique identifier of the user.
//
// Returns:
//   - []int: A list of IDs retrieved by the query.
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the query fails.
func getProjectFollowersOrFollowing(query string, userID int) ([]int, int, error) {
	rows, err := DB.Query(query, userID)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()

	var projectIDs []int
	for rows.Next() {
		var projectID int
		if err := rows.Scan(&projectID); err != nil {
			return nil, http.StatusInternalServerError, err
		}
		projectIDs = append(projectIDs, projectID)
	}

	if err := rows.Err(); err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return projectIDs, http.StatusOK, nil
}

// getProjectFollowersOrFollowingUsernames is a helper function for retrieving follower or following usernames.
//
// Parameters:
//   - query: The SQL query string to execute.
//   - projectID: The unique identifier of the project.
//
// Returns:
//   - []string: A list of usernames retrieved by the query.
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the query fails.
func getProjectFollowersOrFollowingUsernames(query string, projectID int) ([]string, int, error) {
	rows, err := DB.Query(query, projectID)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()

	var projectNames []string
	for rows.Next() {
		var projectName string
		if err := rows.Scan(&projectName); err != nil {
			return nil, http.StatusInternalServerError, err
		}
		projectNames = append(projectNames, projectName)
	}

	if err := rows.Err(); err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return projectNames, http.StatusOK, nil
}

// CreateNewProjectFollow creates a follow relationship between a user and a project.
//
// Parameters:
//   - username: The username of the user creating the follow.
//   - projectID: The ID of the project to follow (as a string, converted internally).
//
// Returns:
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the operation fails or the user is already following the project.
func CreateNewProjectFollow(username string, projectID string) (int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred getting id for username: %v", username)
	}

	intProjectID, err := strconv.Atoi(projectID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred parsing project id: %v", projectID)
	}
	currFollowing, httpCode, err := QueryGetProjectFollowers(userID)
	if err != nil {
		return httpCode, fmt.Errorf("Cannot retrieve user's following list: %v", err)
	}

    existingProj, err := QueryProject(intProjectID)
    if err != nil {
        return http.StatusInternalServerError, fmt.Errorf("Error querying for existing project: %v", err)
    }

    if existingProj == nil {
        return http.StatusNotFound, fmt.Errorf("Project with id %v does not exist", intProjectID)
    }

	if slices.Contains(currFollowing, intProjectID) {
		return http.StatusConflict, fmt.Errorf("User is already following this project")
	}

	query := `INSERT INTO ProjectFollows (user_id, project_id) VALUES (?, ?)`
	rowsAffected, err := ExecUpdate(query, userID, projectID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred adding project follow: %v", err)
	}

	if rowsAffected == 0 {
		return http.StatusInternalServerError, fmt.Errorf("Failed to add the follow relationship")
	}

	return http.StatusOK, nil
}

// RemoveProjectFollow removes a follow relationship between a user and a project.
//
// Parameters:
//   - username: The username of the user removing the follow.
//   - projectID: The ID of the project to unfollow (as a string, converted internally).
//
// Returns:
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the operation fails or the user is not following the project.
func RemoveProjectFollow(username string, projectID string) (int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred getting id for username: %v", username)
	}

	intProjectID, err := strconv.Atoi(projectID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred parsing project id: %v", projectID)
	}

    existingProj, err := QueryProject(intProjectID)
    if err != nil {
        return http.StatusInternalServerError, fmt.Errorf("Error querying for existing project: %v", err)
    }

    if existingProj == nil {
        return http.StatusNotFound, fmt.Errorf("Project with id %v does not exist", intProjectID)
    }

	currFollowing, httpCode, err := QueryGetProjectFollowers(userID)
	if err != nil {
		return httpCode, fmt.Errorf("Error retrieving user's following list: %v", err)
	}

	if !slices.Contains(currFollowing, intProjectID) {
		return http.StatusConflict, fmt.Errorf("User is not following this project")
	}

	query := `DELETE FROM ProjectFollows WHERE user_id = ? AND project_id = ?`
	rowsAffected, err := ExecUpdate(query, userID, projectID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred removing project follow: %v", err)
	}

	if rowsAffected == 0 {
		return http.StatusConflict, fmt.Errorf("No such follow relationship exists")
	}

	return http.StatusOK, nil
}

// CreateProjectLike creates a like relationship between a user and a project.
//
// Parameters:
//   - username: The username of the user creating the like.
//   - projectID: The ID of the project to like (as a string, converted internally).
//
// Returns:
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the operation fails or the user is not liking the project.
func CreateProjectLike(username string, strProjId string) (int, error) {
	// get user ID from username, implicitly checks if user exists
	user_id, err := GetUserIdByUsername(username)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred getting id for username: %v", err)
	}

	// parse project ID
	projId, err := strconv.Atoi(strProjId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred parsing proj_id: %v", err)
	}

	// verify project exists
    existingProj, err := QueryProject(projId)
    if err != nil {
        return http.StatusInternalServerError, fmt.Errorf("Error querying for existing project: %v", err)
    }

    if existingProj == nil {
        return http.StatusNotFound, fmt.Errorf("Project with id %v does not exist", projId)
    }

	// check if the like already exists
	var exists bool
	query := `SELECT EXISTS (
                 SELECT 1 FROM ProjectLikes WHERE user_id = ? AND project_id = ?
              )`
	err = DB.QueryRow(query, user_id, projId).Scan(&exists)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred checking like existence: %v", err)
	}
	if exists {
		// like already exists, but we return success to keep it idempotent
		return http.StatusOK, nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return -1, fmt.Errorf("failed to begin transaction: %v", err)
	}

	defer func() {
		if err != nil {
			tx.Rollback()
		} else {
			tx.Commit()
		}
	}()

	// insert the like
	insertQuery := `INSERT INTO ProjectLikes (user_id, project_id) VALUES (?, ?)`
	_, err = tx.Exec(insertQuery, user_id, projId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to insert project like: %v", err)
	}

	// update the likes column
	updateQuery := `UPDATE Projects SET likes = likes + 1 WHERE id = ?`
	_, err = tx.Exec(updateQuery, projId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to update likes count: %v", err)
	}

	return http.StatusCreated, nil
}

// RemoveProjectLike deletes a like relationship between a user and a project.
//
// Parameters:
//   - username: The username of the user removing the like.
//   - projectID: The ID of the project to unlike (as a string, converted internally).
//
// Returns:
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the operation fails or the user is not liking the project.
func RemoveProjectLike(username string, strProjId string) (int, error) {
	// get user ID
	user_id, err := GetUserIdByUsername(username)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred getting id for username: %v", err)
	}

	// parse project ID
	projId, err := strconv.Atoi(strProjId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred parsing username id: %v", err)
	}

	// verify project exists
    existingProj, err := QueryProject(projId)
    if err != nil {
        return http.StatusInternalServerError, fmt.Errorf("Error querying for existing project: %v", err)
    }

    if existingProj == nil {
        return http.StatusNotFound, fmt.Errorf("Project with id %v does not exist", projId)
    }

	tx, err := DB.Begin()
	if err != nil {
		return -1, fmt.Errorf("failed to begin transaction: %v", err)
	}

	defer func() {
		if err != nil {
			tx.Rollback()
		} else {
			tx.Commit()
		}
	}()

	// perform the delete operation
	deleteQuery := `DELETE FROM ProjectLikes WHERE user_id = ? AND project_id = ?`
	result, err := tx.Exec(deleteQuery, user_id, projId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to delete project like: %v", err)
	}

	// check if any rows were actually deleted
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to check rows affected: %v", err)
	}

	if rowsAffected == 0 {
		// if no rows were deleted, return success to keep idempotency
		return http.StatusNoContent, nil
	}

	// update the likes column
	updateQuery := `UPDATE Projects SET likes = likes - 1 WHERE id = ?`
	_, err = tx.Exec(updateQuery, projId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to update likes count: %v", err)
	}

	return http.StatusOK, nil
}

// QueryProjectLike queries for a like relationship between a user and a project.
//
// Parameters:
//   - username: The username of the user removing the like.
//   - projectID: The ID of the project to unlike (as a string, converted internally).
//
// Returns:
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the operation fails or.
func QueryProjectLike(username string, strProjId string) (int, bool, error) {
	// get user ID from username, implicitly checks if user exists
	user_id, err := GetUserIdByUsername(username)
	if err != nil {
		return http.StatusInternalServerError, false, fmt.Errorf("An error occurred getting id for username: %v", err)
	}

	// parse project ID
	projId, err := strconv.Atoi(strProjId)
	if err != nil {
		return http.StatusInternalServerError, false, fmt.Errorf("An error occurred parsing proj_id: %v", err)
	}

	// verify project exists
    existingProj, err := QueryProject(projId)

	if err != nil {
		return http.StatusInternalServerError, false, fmt.Errorf("An error occurred verifying the project exists: %v", err)
	}
    if existingProj == nil {
        return http.StatusNotFound, false, fmt.Errorf("Project with id %v does not exist", projId)
    }

	// check if the like already exists
	var exists bool
	query := `SELECT EXISTS (
                 SELECT 1 FROM ProjectLikes WHERE user_id = ? AND project_id = ?
              )`
	err = DB.QueryRow(query, user_id, projId).Scan(&exists)
	if err != nil {
		return http.StatusInternalServerError, false, fmt.Errorf("An error occurred checking like existence: %v", err)
	}
	if exists {
		return http.StatusOK, true, nil
	} else {
		return http.StatusOK, false, nil
	}

}
