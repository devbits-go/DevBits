package database

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"backend/api/internal/logger"
	"backend/api/internal/types"
)

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
            logger.Log.Infof("No project found with id: %d", id)
            return nil, nil
        }
        return nil, err
    }

    if err := json.Unmarshal([]byte(linksJSON), &project.Links); err != nil {
        logger.Log.Infof("Error parsing links JSON: %v", err)
        return nil, fmt.Errorf("Error parsing links JSON: %v", err)
    }
    if err := json.Unmarshal([]byte(tagsJSON), &project.Tags); err != nil {
        logger.Log.Infof("Error parsing tags JSON: %v", err)
        return nil, fmt.Errorf("Error parsing tags JSON: %v", err)
    }

    return &project, nil
}

func QueryCreateProject(proj *types.Project) error {
	linksJSON, err := json.Marshal(proj.Links)
	if err != nil {
		logger.Log.Errorf("Failed to marshal links for project `%v`: %v", proj.Name, err)
		return fmt.Errorf("Failed to marshal links for project `%v`: %v", proj.Name, err)
	}

	tagsJSON, err := json.Marshal(proj.Tags)
	if err != nil {
		logger.Log.Errorf("Failed to marshal tags for project `%v`: %v", proj.Name, err)
		return fmt.Errorf("Failed to marshal tags for project `%v`: %v", proj.Name, err)
	}
    query := `INSERT INTO Projects (name, description, status, links, tags, owner)
              VALUES (?, ?, ?, ?, ?, ?);`

    res, err := DB.Exec(query, proj.Name, proj.Description, proj.Status, string(linksJSON), string(tagsJSON), proj.Owner)

    if err != nil {
        logger.Log.Errorf("Failed to create project `%v`: `%v", proj.Name, err)
    }

	lastId, err := res.LastInsertId()
	if err != nil {
		logger.Log.Errorf("Failed to ensure proj was created: %v", err)
		return fmt.Errorf("Failed to ensure proj was created: %v", err)
	}

	logger.Log.Infof("Created proj %v with id `%v`", proj.Name, lastId)
	return nil
}
