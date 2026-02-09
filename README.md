# DevBits

## Note: This project was not funded and ultimately development ended on it, it is now READ ONLY and archived.

## Goal: Create an X and LinkedIn crossover for posting real content about your projects, semi-formally

### Outline

Projects are the baseline of the app, you must have a project to post.

Anyone can comment, like, follow, despite their project count.

Some quirky names for things (frontend only)

- Projects are called 'Stream's
- Posts about projects are called 'Byte's
- Comments are called 'Bit's

### Tech Stack

- Backend/API in Go, Elixir/Scala if need big data processing
- Frontend: ReactNative and Expo
- Database: PostgreSQL or MySQL
- Host: On AWS, full system design pending

## Local Testing

### Backend Testing

Install the following packages:

- [**Go**](https://go.dev/doc/install) (for running the API)
- [**SQLite3**](https://www.sqlite.org/index.html) (for database operations)

#### 1. Navigate to the Project Root

Change into the project directory:

```bash
cd /path/to/DevBits
```

#### 2. Start the Database

1. Open a terminal and navigate to the database directory:

   ```bash
   cd backend/api/internal/database
   ```

2. Launch the SQLite database:

   ```bash
   sqlite3 dev.sqlite3
   ```

3. (Optional) Open the `create_tables.sql` file in a new terminal for reference:

   ```bash
   nvim create_tables.sql
   ```

#### 3. Start the API

1. Open another terminal and navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Run the API:

   ```bash
   go run ./api
   ```

That's it! You're ready to start working with the DevBits API and database.

---

### Frontend Testing

Install the following packages:

- [**Node**](https://nodejs.org/en/download/package-manager) (for running the React Native App)

#### 1. Navigate to the DevBits Frontend

Change into the project directory:

```bash
cd /path/to/DevBits/frontend
```

#### 2. Check required packages are installed

```bash
npm install
```

#### 3. Start the app

```bash
npm run frontend
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

### Run app

#### 1. Navigate to the DevBits frontend (required to run npm commands)

Change into the project directory:

```bash
cd /path/to/DevBits/frontend
```

#### 2. Run all required commands

```bash
npm run all
```

#### Windows quick start (root script)

From the project root, you can launch backend + frontend together:

```powershell
./run-all.ps1
```
