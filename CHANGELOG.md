# Change Log

All notable changes to the "VS Code Alembic" extension will be documented in this file.

## [0.0.2] - 2025-09-27

### Added

- **Settings Editor**: Visual editor for `alembic.ini` configuration
  - File template presets (default, date-based, custom formats)
  - Timezone configuration support
  - Slug length truncation settings
  - Path validation with real-time feedback
  - Support for `sqlalchemy.url` configuration
  - Management of `version_locations` and `version_path_separator`
- **Model Inspector**: Analyze SQLAlchemy model visibility
  - Shows which models are visible/hidden to Alembic
  - Helps troubleshoot model discovery issues
  - Webview interface for detailed inspection results
- **Enhanced Migration Management**:
  - Branch merging functionality for multiple migration heads
  - Open migration files directly from tree view
  - Improved error handling and user feedback
  - Better migration status indicators
- **Python Auto-Detection**:
  - Automatic detection of Python interpreters
  - Support for virtual environments (venv, .venv, env)
  - Conda environment detection
  - Manual Python interpreter selection
- **Configuration Improvements**:
  - Enhanced configuration management
  - Better handling of Alembic paths and settings
  - Improved workspace configuration detection

### Enhanced

- **Migration Graph**:
  - Better performance and interaction handling
  - Streamlined graph visualization
  - Enhanced node selection and actions
- **Command Processing**:
  - Improved error handling across all commands
  - Better feedback for migration operations
  - Enhanced migration loading and status detection
- **Development Experience**:
  - Watch mode configuration for debugging
  - Standardized code formatting
  - Better TypeScript configuration

### Technical Improvements

- Modular webview architecture for extensibility
- Enhanced API for migration retrieval
- Improved file system watching and auto-refresh
- Better error reporting and logging
- Streamlined command registration and handling

## [0.0.1] - 2025-08-02

### Added

- Initial release of VS Code Alembic
- Migration tree view with status indicators (Current, Applied, Pending)
- Interactive migration graph visualization using vis.js
- Basic Alembic commands:
  - Initialize Alembic project
  - Create new migrations with autogenerate
  - Upgrade/downgrade database
  - Show migration history
- Configuration settings for customizing Alembic paths and behavior
- Auto-refresh functionality when migration files change
- File system watcher for automatic updates
- Webview panel for migration graph visualization
- Output channel for Alembic command results

### Technical Features

- TypeScript implementation with VS Code API
- Tree data provider for migration explorer
- Webview with HTML/CSS/JavaScript for graph visualization
- Command palette integration
- Context menu support for migration operations
- Configuration contribution for extension settings
