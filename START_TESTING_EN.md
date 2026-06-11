# Getting Started with VS Code Alembic Extension Testing

This guide helps you quickly run the extension in development mode and verify the main Alembic workflows.

## 1. Prepare the Project

Open the extension repository and install dependencies:

```bash
make install
```

Check that the project builds successfully:

```bash
make compile
```

Run automated tests with:

```bash
make test
```

List all available automation commands:

```bash
make help
```

## 2. Run the Extension in VS Code

1. Open this repository in VS Code.
2. Go to `Run and Debug`.
3. Select the `Run Extension` configuration.
4. Press `F5`.

A new VS Code window marked `[Extension Development Host]` will open. Use that window to test the extension.

## 3. Create a Test Alembic Project

Create a temporary project for testing. This command creates a virtualenv, installs `alembic`, `sqlalchemy`, and `psycopg2-binary`, adds `docker-compose.yml`, creates a test `models.py`, and configures `alembic.ini` for Postgres:

```bash
make test-project
```

In the `[Extension Development Host]` window, open `/tmp/test-alembic-project` with `File -> Open Folder`.

Start the test database:

```bash
make test-db-up
```

Create a sample autogenerate migration from the `User` model:

```bash
make test-project-migration
```

This target runs `alembic upgrade head` before generation because Alembic will not create a new autogenerate migration when the database is behind the current `head`.

Apply migrations and check database state:

```bash
make test-db-upgrade
make test-db-current
make test-db-history
```

Downgrade migrations:

```bash
make test-db-downgrade
```

Stop the container:

```bash
make test-db-down
```

If the `code` CLI is installed, open the test project with this extension in development mode:

```bash
make launch-test
```

Override the test project path when needed:

```bash
make test-project TEST_PROJECT_DIR=/tmp/my-alembic-check
```

The default Postgres port is `55432` to avoid conflicts with a local database on `5432`. Override it when needed:

```bash
make test-db-up TEST_DB_PORT=55433
```

## 4. First Extension Checks

Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and run:

- `Alembic: Show Version` - verify that Alembic is detected.
- `Alembic: Initialize Alembic` - create `alembic.ini` and the migrations directory.
- `Alembic: Create New Migration` - create a test migration.
- `Alembic: Show Migration Graph` - open the migration graph.
- `Alembic: Open Settings` or `Alembic: Configure Settings` - verify extension settings.

After initialization, the VS Code side bar should show the `Alembic` container and the `Alembic Migrations` view.

## 5. Manual Test Checklist

- The extension activates without errors.
- The `Alembic` Output Channel shows command output.
- Commands work with the selected Python interpreter.
- Migrations appear in the `Alembic Migrations` tree.
- The migration graph opens and refreshes.
- Webview settings save changes to `alembic.ini`.

## 6. Troubleshooting

If commands fail, check that:

- Alembic is installed in the active Python environment;
- `alembic.pythonPath` points to the correct interpreter;
- the opened folder contains or can create `alembic.ini`;
- `alembic.ini` does not still contain the `driver://user:pass@localhost/dbname` placeholder;
- the Postgres container is running via `make test-db-up`;
- there are no errors in `Help -> Toggle Developer Tools -> Console`;
- the `Alembic` Output Channel does not contain additional diagnostics.

Before submitting changes, run:

```bash
make compile
make test
```
