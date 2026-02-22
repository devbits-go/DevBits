// The database package includes the functions to take in data from a handler
// and do any database CRUD operations to make the workflow of the app
// work correctly.
//
// It mainly uses the database/sql package and encoding/json to
// parse json data and integrate SQL types and communications between
// this package and the database
package database

import (
	"encoding/json"
	"fmt"

	"backend/api/internal/logger"
)

// takes in some sort of data, and changes it to a JSON
// data type. Will return an error if it is not JSON-esque data
//
// input:
//      interface (interface{}) - the data to be converted to JSON
// output:
//      the JSON string
//      an error

func MarshalToJSON(value interface{}) (string, error) {
	linksJSON, err := json.Marshal(value)
	if err != nil {
		logger.Log.Errorf("Failed to marshal value: %v", err)
		return "", fmt.Errorf("Failed to marshal value: %v", err)
	}
	return string(linksJSON), nil
}

// takes in some JSON data, and changes it to a JSON
// data type. Will return an error if it is not JSON-esque data
//
// input:
//      data (string) - the data in a string, edited in place
//      interface (interface{}) - the data to be put into the string
// output:
//      error

func UnmarshalFromJSON(data string, target interface{}) error {
	err := json.Unmarshal([]byte(data), target)
	if err != nil {
		logger.Log.Errorf("Error parsing JSON: %v", err)
		return fmt.Errorf("Error parsing JSON: %v", err)
	}
	return nil
}

// takes in a query and some params to add to it
// and will execute the update query, given the database is
// setup and connected.
//
// input:
//      query (string) - the base query string
//      args (...interface{}) - the params of the query
// output:
//      *sql.Rows - the affected rows
//      error

func ExecUpdate(query string, args ...interface{}) (int64, error) {
	res, err := DB.Exec(query, args...)
	if err != nil {
		logger.Log.Errorf("Error executing update query: %v", err)
		return 0, fmt.Errorf("Error executing update query: %v", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		logger.Log.Errorf("Error checking rows affected: %v", err)
		return 0, fmt.Errorf("Error checking rows affected: %v", err)
	}
	return rowsAffected, nil
}

// BuildUpdateQuery is a utility function that handles the construction of an UPDATE query
// and prepares the corresponding arguments, including marshaling JSON data for special fields (like links and tags).
//
// input:
//
//	updatedData (map[string]interface{}) - a JSON like structure with all of the updatedData for the query
//
// output:
//
//	string - the partially completed query, with all of the fields added
//	[]interface{} - the arguments for the query
//	the error
func BuildUpdateQuery(updatedData map[string]interface{}) (string, []interface{}, error) {
	var query string
	var args []interface{}
	placeholderIndex := 1

	// dynamically add fields to the query based on the available data in updatedData
	for key, value := range updatedData {
		if key == "created_on" {
			key = "creation_date"
		}
		// the following switch statement should work fine for all
		// items that are, or can be strings,
		// I feel like this may look stupid now, but will revisit
		// if needs changes. This allows for only awkward
		// datatypes, like the links, to be handled differently.
		switch key {
		case "links", "tags", "settings", "media":
			jsonData, err := MarshalToJSON(value)
			if err != nil {
				return "", nil, fmt.Errorf("Error marshaling list data for key `%v`: %v", key, err)
			}
			query += fmt.Sprintf("%v = $%d, ", key, placeholderIndex)
			args = append(args, string(jsonData))
			placeholderIndex++
		default:
			query += fmt.Sprintf("%v = $%d, ", key, placeholderIndex)
			args = append(args, value)
			placeholderIndex++
		}
	}

	// continue formatting query
	// get rid of trailing space and comma
	query = query[:len(query)-2]
	// NOTICE we DO NOT add the `WHERE` clause here
	return query, args, nil
}
