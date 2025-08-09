# Change Log

All notable changes to the "VS Code Alembic" extension will be documented in this file.

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
