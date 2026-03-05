package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/lib/pq" // PostgreSQL driver
	_ "modernc.org/sqlite"
)

var DB *sql.DB // Global database instance

// driverName stores the active database driver ("postgres" or "sqlite").
var driverName string

func resolveSqlitePath() string {
	candidates := []string{
		filepath.Join(".", "api", "internal", "database", "dev.sqlite3"),
		filepath.Join(".", "internal", "database", "dev.sqlite3"),
		filepath.Join(".", "dev.sqlite3"),
	}

	for _, candidate := range candidates {
		dir := filepath.Dir(candidate)
		if stat, err := os.Stat(dir); err == nil && stat.IsDir() {
			return candidate
		}
	}

	return filepath.Join(".", "internal", "database", "dev.sqlite3")
}

// Connect initializes a database connection
func Connect() {
	var err error
	var dsn string

	// Check for test database mode
	if os.Getenv("USE_TEST_DB") == "true" {
		driverName = "postgres"
		db := os.Getenv("POSTGRES_TEST_DB")
		if db == "" {
			db = "devbits_test"
		}
		user := os.Getenv("POSTGRES_TEST_USER")
		if user == "" {
			user = "testuser"
		}
		password := os.Getenv("POSTGRES_TEST_PASSWORD")
		if password == "" {
			log.Fatal("POSTGRES_TEST_PASSWORD is required when USE_TEST_DB=true")
		}
		host := os.Getenv("POSTGRES_TEST_HOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("POSTGRES_TEST_PORT")
		if port == "" {
			port = "5432"
		}
		log.Printf("Using test Postgres host: %s", host)
		dsn = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", user, password, host, port, db)
	} else if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		// Production PostgreSQL connection
		driverName = "postgres"
		dsn = dbURL
	} else {
		// Fallback to SQLite for local development
		driverName = "sqlite"
		dbPath := resolveSqlitePath()
		if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
			log.Fatalf("Failed to create sqlite directory: %v", err)
		}
		dsn = dbPath
	}

	DB, err = sql.Open(driverName, dsn)
	if err != nil {
		log.Fatalf("Failed to open database connection: %v", err)
	}

	// Verify connection (retry for postgres to handle cold starts / deploy races)
	if driverName == "postgres" {
		const maxAttempts = 30
		const retryDelay = 2 * time.Second
		for attempt := 1; attempt <= maxAttempts; attempt++ {
			err = DB.Ping()
			if err == nil {
				break
			}
			log.Printf("Postgres ping attempt %d/%d failed: %v", attempt, maxAttempts, err)
			if attempt < maxAttempts {
				time.Sleep(retryDelay)
			}
		}
		if err != nil {
			log.Fatalf("Failed to ping database after retries: %v", err)
		}
	} else {
		err = DB.Ping()
		if err != nil {
			log.Fatalf("Failed to ping database: %v", err)
		}
	}

	// Apply driver-specific configurations
	if driverName == "postgres" {
		if err := ensurePostgresSchema(); err != nil {
			log.Fatalf("Failed to initialize postgres database schema: %v", err)
		}
	} else if driverName == "sqlite" {
		if _, err := DB.Exec("PRAGMA foreign_keys=ON;"); err != nil {
			log.Printf("WARN: failed to enable foreign keys: %v", err)
		}
		if _, err := DB.Exec("PRAGMA journal_mode=WAL;"); err != nil {
			log.Printf("WARN: failed to set WAL mode: %v", err)
		}
		if _, err := DB.Exec("PRAGMA busy_timeout=5000;"); err != nil {
			log.Printf("WARN: failed to set busy timeout: %v", err)
		}
		if err := ensureSqliteSchema(); err != nil {
			log.Fatalf("Failed to initialize sqlite database schema: %v", err)
		}
	}

	log.Printf("Database connected successfully using %s driver", driverName)
}

func ensurePostgresSchema() error {
	if err := execSqlFile("create_tables.sql"); err != nil {
		return err
	}
	if err := ensureDirectMessageIntegrityForPostgres(); err != nil {
		return err
	}
	log.Println("PostgreSQL schema ensured successfully.")
	return nil
}

func ensureSqliteSchema() error {
	// For SQLite, we'll just run the schema file every time.
	// This is simple and effective for a dev database.
	if err := execSqlFile("create_tables.sql"); err != nil {
		return err
	}
	return nil
}

func execSqlFile(filename string) error {
	rel := filepath.Join("api", "internal", "database", filename)

	// Try several locations: current dir, and up to 4 parent dirs.
	var content []byte
	var err error
	tried := []string{}
	dir := "."
	for i := 0; i < 5; i++ {
		path := filepath.Clean(filepath.Join(dir, rel))
		tried = append(tried, path)
		content, err = os.ReadFile(path)
		if err == nil {
			break
		}
		dir = filepath.Join(dir, "..")
	}
	if err != nil {
		return fmt.Errorf("failed to read %s (tried: %v): %w", rel, tried, err)
	}

	statements := strings.Split(string(content), ";")
	for _, statement := range statements {
		stmt := strings.TrimSpace(statement)
		if stmt == "" {
			continue
		}
		if _, err := DB.Exec(stmt); err != nil {
			return fmt.Errorf("failed to exec statement in %s: %w", filename, err)
		}
	}

	return nil
}

func ensureDirectMessageIntegrityForPostgres() error {
	if _, err := DB.Exec(`DELETE FROM directmessages dm
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dm.sender_id)
   OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dm.recipient_id);`); err != nil {
		return fmt.Errorf("failed to clean orphaned direct messages: %w", err)
	}

	if _, err := DB.Exec(`DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'directmessages_sender_id_fkey'
	) THEN
		ALTER TABLE directmessages
		ADD CONSTRAINT directmessages_sender_id_fkey
		FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
	END IF;
END $$;`); err != nil {
		return fmt.Errorf("failed to ensure sender foreign key on directmessages: %w", err)
	}

	if _, err := DB.Exec(`DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'directmessages_recipient_id_fkey'
	) THEN
		ALTER TABLE directmessages
		ADD CONSTRAINT directmessages_recipient_id_fkey
		FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
	END IF;
END $$;`); err != nil {
		return fmt.Errorf("failed to ensure recipient foreign key on directmessages: %w", err)
	}

	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_directmessages_created_at
ON directmessages (creation_date DESC, id DESC);`); err != nil {
		return fmt.Errorf("failed to ensure directmessages recency index: %w", err)
	}

	return nil
}
