# VS Code Alembic

Visual Studio Code extension for managing Alembic database migrations with an intuitive interface and graph visualization.

## Features

- 🌳 **Tree View**: Browse migrations with clear status indicators (Current, Applied, Pending)
- 📊 **Migration Graph**: Visualize migration dependencies as an interactive graph (like git)
- ⚡ **Quick Actions**: Create, upgrade, and downgrade migrations with one click
- 🔧 **Configuration**: Customizable Alembic settings through VS Code preferences
- � **Python Auto-Detection**: Automatically detects Python interpreters in workspace and system
- �📝 **History View**: Browse migration history with detailed information
- 🔄 **Auto-refresh**: Automatically update when migration files change

## Installation

1. Install from VS Code Marketplace
2. Open a workspace with an Alembic project
3. The extension will automatically detect `alembic.ini` files

## Quick Start

1. **Python Setup** (automatic):

   - The extension automatically detects Python interpreters in your workspace
   - Supports virtual environments (venv, .venv, env), Conda environments, and system Python
   - If needed, manually select with `Alembic: Select Python Interpreter`

2. **Initialize Alembic** (if not already done):

   - Open Command Palette (`Ctrl+Shift+P`)
   - Run `Alembic: Initialize Alembic`

3. **View Migrations**:

   - Check the "Alembic Migrations" view in the Explorer panel
   - Click the graph icon to see migration dependencies

4. **Create Migration**:

   - Click the `+` icon in the migration view
   - Enter a descriptive message

5. **Upgrade/Downgrade**:
   - Right-click on a migration in the tree view
   - Select upgrade or downgrade

## Commands

| Command                              | Description                                      |
| ------------------------------------ | ------------------------------------------------ |
| `Alembic: Initialize Alembic`        | Initialize Alembic in current workspace          |
| `Alembic: Show Migration Graph`      | Open interactive migration dependency graph      |
| `Alembic: Create New Migration`      | Create a new migration with autogenerate         |
| `Alembic: Upgrade Database`          | Upgrade database to a specific revision          |
| `Alembic: Downgrade Database`        | Downgrade database to a specific revision        |
| `Alembic: Show Migration History`    | Display migration history in output panel        |
| `Alembic: Show Version`              | Display current Alembic version                  |
| `Alembic: Select Python Interpreter` | Choose Python interpreter for Alembic operations |

## Available Templates

When initializing Alembic, the extension automatically detects available templates by running `alembic list_templates` and uses the original descriptions from your Alembic installation:

**Common Templates** (availability depends on your Alembic version):

| Template          | Description (from Alembic)                                  | When to Use                                               |
| ----------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| **`generic`**     | Generic single-database configuration                       | **Recommended for most projects** - standard setup        |
| `async`           | Generic single-database configuration with an async dbapi   | Async frameworks (FastAPI, aiohttp) with asyncpg/aiomysql |
| `multidb`         | Rudimentary multi-database configuration                    | Applications managing multiple databases                  |
| `pyproject`       | pyproject configuration, based on the generic configuration | Modern Python projects using pyproject.toml               |
| `pyproject_async` | pyproject configuration, with an async dbapi                | Modern Python + async database operations                 |

**Template Selection Features**:

- **Original descriptions**: Uses exact descriptions from your Alembic installation
- **Version-aware**: Only shows templates available in your Alembic version
- **Smart defaults**: `generic` template is marked as recommended and appears first
- **Graceful fallback**: Common templates if auto-detection fails
- **Custom directory**: Specify custom directory name (default: `alembic`)
- **Version info**: Displays Alembic version during initialization

**Note**: Template availability varies by Alembic version. Newer templates like `pyproject` may not be available in older Alembic installations.

## Configuration

Configure the extension through VS Code settings:

```json
{
  "alembic.pythonPath": "python",
  "alembic.alembicPath": "alembic",
  "alembic.configFile": "alembic.ini",
  "alembic.autoRefresh": true,
  "alembic.showFullHash": false
}
```

### Settings

- **`alembic.pythonPath`**: Path to Python executable (default: `python`)
- **`alembic.alembicPath`**: Path to Alembic executable (default: `alembic`)
- **`alembic.configFile`**: Path to alembic.ini configuration file (default: `alembic.ini`)
- **`alembic.autoRefresh`**: Automatically refresh migration list when files change (default: `true`)
- **`alembic.showFullHash`**: Show full migration hash instead of abbreviated (default: `false`)

## Prerequisites

- Python with Alembic installed
- Alembic configuration file (`alembic.ini`)
- SQL database configured with Alembic

## Migration Graph

The migration graph provides a visual representation of your migration dependencies:

- **Green nodes**: Current migration
- **Blue nodes**: Applied migrations
- **Orange nodes**: Pending migrations
- **Arrows**: Show migration dependencies

### Graph Controls

- **Refresh**: Update graph with latest migration data
- **Fit to Screen**: Adjust zoom to show all migrations
- **Toggle Physics**: Enable/disable automatic layout animation

## Development

### Building from Source

```bash
git clone https://github.com/Nie1iX/vscode-alembic
cd vscode-alembic
npm install
npm run compile
```

### Running Tests

```bash
npm test
```

## Python Auto-Detection

The extension automatically detects and configures Python interpreters with the following priority:

1. **VS Code Python Extension**: Uses the currently selected interpreter from the Python extension
2. **Workspace Virtual Environments**: Detects `venv`, `.venv`, `env` folders in your workspace
3. **Conda Environments**: Lists available Conda environments
4. **System Python**: Finds system-installed Python interpreters

### Supported Virtual Environment Patterns

- `./venv/` - Standard virtual environment
- `./.venv/` - Hidden virtual environment (common in modern Python projects)
- `./env/` - Alternative naming convention

### Manual Configuration

If auto-detection doesn't work or you need a specific interpreter:

1. Use Command Palette: `Alembic: Select Python Interpreter`
2. Or configure manually in VS Code settings: `alembic.pythonPath`

### Package Extension

```bash
npm run package
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 🐛 [Report Issues](https://github.com/Nie1iX/vscode-alembic/issues)
- 💡 [Request Features](https://github.com/Nie1iX/vscode-alembic/issues)
- 📖 [Documentation](https://github.com/Nie1iX/vscode-alembic/wiki)

## Release Notes

### 0.0.1

Initial release with basic functionality:

- Migration tree view
- Migration graph visualization
- Basic Alembic commands
- Configuration support
