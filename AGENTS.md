# Repository Guidelines

## Project Structure & Module Organization

This repository is a VS Code extension for Alembic migration workflows. Core TypeScript code lives in `src/`: `extension.ts` is the activation entry point, `providers/` contains tree views, `services/` contains Alembic and model-inspection logic, `webviews/` builds panels, `models/` defines shared data, `utils/` holds helpers, and `config/` manages settings. Tests are in `src/test/*.test.ts`. Static webview assets are in `media/`, syntax definitions in `syntaxes/`, icons and Python inspection helpers in `resources/`, and support scripts in `scripts/`.

## Build, Test, and Development Commands

- `npm install`: install project dependencies from `package-lock.json`.
- `npm run check-types`: run TypeScript strict type checking without emitting files.
- `npm run lint`: lint `src/` with ESLint.
- `npm run format:check`: verify Prettier formatting.
- `npm run compile`: type-check, lint, and bundle the extension with `esbuild.js`.
- `npm run watch`: run TypeScript and esbuild watchers during extension development.
- `npm test`: compile tests, compile the extension, lint, then run VS Code extension tests via `vscode-test`.
- `npm run package`: production bundle used by `vscode:prepublish`.

For manual testing, press `F5` in VS Code to launch the Extension Development Host.

## Coding Style & Naming Conventions

Use TypeScript `strict` mode with CommonJS output targeting ES2022. Follow the existing style: semicolons, strict equality, curly braces, and thrown `Error` objects instead of string literals. Imports should use `camelCase` or `PascalCase` names per ESLint. Keep source filenames descriptive and camelCase, for example `alembicService.ts`.

## Testing Guidelines

Tests use the VS Code test runner with Mocha-style files under `src/test/`. Name new tests `*.test.ts` and keep them close to the behavior being verified, such as `alembicUtils.test.ts`. Prefer focused tests for utilities and service behavior, and add extension-host tests when commands, activation, or VS Code API integration changes. Run `npm test` before pull requests.

## Commit & Pull Request Guidelines

Git history uses Conventional Commit prefixes such as `feat:`, `fix:`, and `refactor:`. Keep commit subjects imperative and specific, for example `fix: update settings editor validation`. Pull requests should include a summary, linked issues when applicable, test results, and screenshots or GIFs for visible webview or VS Code UI changes.

## Security & Configuration Tips

Do not commit local Python virtual environments, generated Alembic test projects, or secrets. Configuration defaults are declared in `package.json`; keep new settings documented there and reflected in relevant UI or README updates.
