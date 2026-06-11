import * as vscode from "vscode";
import { AlembicMigrationProvider } from "./providers/migrationProvider";
import { AlembicService } from "./services/alembicService";
import { MigrationGraphWebview } from "./webviews/migrationGraph";
import { ModelInspectorWebview } from "./webviews/modelInspectorView";
import { ConfigurationManager } from "./config/configurationManager";
import { PythonDetector } from "./utils/pythonDetector";
import { AlembicIniEditorWebview } from "./webviews/settingsEditor";
import { ModelInspector } from "./services/modelInspector";

export function activate(context: vscode.ExtensionContext) {
  console.log("VS Code Alembic extension is now active!");

  // Initialize services
  const alembicService = new AlembicService();
  const migrationProvider = new AlembicMigrationProvider(alembicService);
  const migrationGraphWebview = new MigrationGraphWebview(
    context,
    alembicService,
  );
  const alembicIniEditor = new AlembicIniEditorWebview(context);
  const modelInspector = new ModelInspector();
  const modelsView = new ModelInspectorWebview(context);
  modelInspector.attachWebview(modelsView);

  // Register tree data provider
  const treeView = vscode.window.createTreeView("alembicMigrations", {
    treeDataProvider: migrationProvider,
    showCollapseAll: true,
  });

  // Check if alembic.ini exists and set context
  checkAlembicConfig();

  // Register commands
  const commands = [
    vscode.commands.registerCommand("alembic.init", () =>
      alembicService.initAlembic(),
    ),
    vscode.commands.registerCommand("alembic.showMigrationGraph", () =>
      migrationGraphWebview.show(),
    ),
    vscode.commands.registerCommand("alembic.createMigration", () =>
      alembicService.createMigration(),
    ),
    vscode.commands.registerCommand("alembic.upgrade", (migration?: any) =>
      alembicService.upgrade(migration?.id),
    ),
    vscode.commands.registerCommand("alembic.upgradeHead", () =>
      alembicService.upgrade("head"),
    ),
    vscode.commands.registerCommand("alembic.downgrade", (migration?: any) =>
      alembicService.downgrade(migration?.id),
    ),
    vscode.commands.registerCommand("alembic.history", () =>
      alembicService.showHistory(),
    ),
    vscode.commands.registerCommand("alembic.refreshMigrations", () =>
      migrationProvider.refresh(),
    ),
    vscode.commands.registerCommand("alembic.openSettings", () =>
      ConfigurationManager.openSettings(),
    ),
    vscode.commands.registerCommand("alembic.configureSettings", () =>
      ConfigurationManager.showConfigurationQuickPick(),
    ),
    vscode.commands.registerCommand("alembic.showVersion", () =>
      alembicService.showVersion(),
    ),
    vscode.commands.registerCommand("alembic.selectPython", () =>
      ConfigurationManager.selectPythonInterpreter(),
    ),
    vscode.commands.registerCommand("alembic.editAlembicIni", () =>
      alembicIniEditor.show(),
    ),
    vscode.commands.registerCommand(
      "alembic.mergeBranches",
      (selectedId?: string) => alembicService.mergeBranches(selectedId),
    ),
    vscode.commands.registerCommand("alembic.inspectModels", async () => {
      modelsView.show();
      await modelInspector.inspectAndReport();
    }),
    vscode.commands.registerCommand("alembic.openMigrationFile", (migrationId: string) =>
      alembicService.openMigrationFile(migrationId),
    ),
  ];

  // Register file system watcher
  const watcher =
    vscode.workspace.createFileSystemWatcher("**/alembic/**/*.py");
  watcher.onDidCreate(() => {
    if (ConfigurationManager.getConfiguration().autoRefresh) {
      migrationProvider.refresh();
    }
  });
  watcher.onDidDelete(() => {
    if (ConfigurationManager.getConfiguration().autoRefresh) {
      migrationProvider.refresh();
    }
  });
  watcher.onDidChange(() => {
    if (ConfigurationManager.getConfiguration().autoRefresh) {
      migrationProvider.refresh();
    }
  });

  // Register configuration change handler
  const configWatcher = ConfigurationManager.onConfigurationChanged((e) => {
    if (ConfigurationManager.affectsAlembicConfiguration(e)) {
      migrationProvider.refresh();
    }
  });
  // Subscribe to python interpreter changes to sync alembic.pythonPath
  const pySync = ConfigurationManager.subscribePythonInterpreterSync();

  // Add all disposables to context
  context.subscriptions.push(
    treeView,
    watcher,
    configWatcher,
    pySync,
    ...commands,
  );

  // Initial configuration validation and refresh
  const config = ConfigurationManager.getConfiguration();
  if (config.autoRefresh) {
    migrationProvider.refresh();
  }

  // Auto-detect Python interpreter if not configured
  setTimeout(async () => {
    await ConfigurationManager.validateConfiguration();

    // Check if we have any configured Python path
    const configuredPath = PythonDetector.getConfiguredPythonPath();
    const currentConfig = ConfigurationManager.getConfiguration();

    // Only auto-detect if no valid Python path is configured
    if (currentConfig.pythonPath === "python" && !configuredPath) {
      const detectedPython = await PythonDetector.autoDetectAndSetPython();
      if (detectedPython) {
        vscode.window.showInformationMessage(
          `Auto-detected Python interpreter: ${detectedPython}`,
        );
      }
    } else if (configuredPath && currentConfig.pythonPath === "python") {
      // Use the configured path from python.defaultInterpreterPath
      const config = vscode.workspace.getConfiguration("alembic");
      await config.update(
        "pythonPath",
        configuredPath,
        vscode.ConfigurationTarget.Workspace,
      );
    }
  }, 1000);
}

async function checkAlembicConfig() {
  const alembicFiles = await vscode.workspace.findFiles(
    "**/alembic.ini",
    null,
    1,
  );
  const hasAlembicConfig = alembicFiles.length > 0;
  vscode.commands.executeCommand(
    "setContext",
    "alembic:hasAlembicConfig",
    hasAlembicConfig,
  );
}

export function deactivate() {}
