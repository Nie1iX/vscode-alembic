import * as vscode from "vscode";
import { ConfigurationManager } from "../config/configurationManager";
import { parseIni, updateIniSection } from "../utils/iniEditor";

export class AlembicIniEditorWebview {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private context: vscode.ExtensionContext) {}

  public async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "alembicIniEditor",
      "Alembic Settings",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    this.panel.webview.html = await this.getHtmlFromTemplate();

    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "load":
          await this.loadIni();
          break;
        case "save":
          await this.saveIni(message.payload);
          break;
        case "applyRevisionStrategy":
          await this.applyRevisionStrategy(message.payload);
          break;
        case "validatePaths":
          await this.validatePaths(message.payload);
          break;
        case "validateVersionLocations":
          await this.validateVersionLocations(message.payload);
          break;
        case "validatePrependSysPath":
          await this.validatePrependSysPath(message.payload);
          break;
        case "checkHookTools":
          await this.checkHookTools(message.payload);
          break;
        case "applyHooks":
          await this.applyHooks(message.payload);
          break;
        case "applyLogging":
          await this.applyLogging(message.payload);
          break;
        case "applyEnvFilters":
          await this.applyEnvFilters(message.payload);
          break;
        case "previewEnvChanges":
          await this.previewEnvChanges(message.payload);
          break;
        case "restoreEnvBackup":
          await this.restoreEnvBackup();
          break;
        case "applyContextOptions":
          await this.applyContextOptions(message.payload);
          break;
        case "previewContextOptions":
          await this.previewContextOptions(message.payload);
          break;
        case "showError":
          vscode.window.showErrorMessage(
            message.payload?.message || "An error occurred",
          );
          break;
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private async getHtmlFromTemplate(): Promise<string> {
    const config = ConfigurationManager.getConfiguration();
    const nonce = String(Date.now());
    const webview = this.panel!.webview;
    const tplUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      "settingsEditor.html",
    );
    const buf = await vscode.workspace.fs.readFile(tplUri);
    let html = Buffer.from(buf).toString("utf8");
    html = html
      .replace(/__NONCE__/g, nonce)
      .replace(/__CSP_SOURCE__/g, webview.cspSource)
      .replace(
        /__INITIAL_CONFIG__/g,
        () => JSON.stringify(config).replace(/[<]/g, "\\u003c"),
      );
    return html;
  }

  private async loadIni(): Promise<void> {
    if (!this.panel) {
      return;
    }
    const cfg = ConfigurationManager.getConfiguration();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      vscode.window.showErrorMessage("Open a workspace to edit alembic.ini");
      return;
    }
    const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, cfg.configFile);
    try {
      const raw = (await vscode.workspace.fs.readFile(uri)).toString();
      const parsed = parseIni(raw);
      this.panel.webview.postMessage({
        command: "setIni",
        payload: { content: raw, parsed },
      });
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to read ${cfg.configFile}: ${e}`);
    }
  }

  private async saveIni(payload: { content: string }): Promise<void> {
    const cfg = ConfigurationManager.getConfiguration();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      return;
    }
    const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, cfg.configFile);
    try {
      await vscode.workspace.fs.writeFile(
        uri,
        Buffer.from(payload.content, "utf8"),
      );
      vscode.window.showInformationMessage("alembic.ini saved");
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to save ${cfg.configFile}: ${e}`);
    }
  }

  private async applyRevisionStrategy(payload: {
    template: string;
    revIdStrategy?: string;
    seqWidth: number;
    hashLength?: number;
    scriptLocation?: string;
    versionLocations?: string;
    versionPathSeparator?: string;
    recursiveVersionLocations?: boolean;
    revisionEnvironment?: boolean;
    prependSysPath?: string;
    timezone?: string;
    truncateSlug?: string;
    sourceless?: boolean;
    outputEncoding?: string;
    sqlalchemyUrl?: string;
  }): Promise<void> {
    const cfg = ConfigurationManager.getConfiguration();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return;
    }
    const uri = vscode.Uri.joinPath(folders[0].uri, cfg.configFile);
    try {
      const raw = (await vscode.workspace.fs.readFile(uri)).toString();
      let updated = raw;
      // For sequential, set a template that uses sequential revision id
      // We implement via env var in template filenames using script naming convention.
      // Minimal viable: add custom config keys that our extension will use on create.
      const base: Record<string, string> = {
        script_location: payload.scriptLocation || "alembic",
        version_locations: payload.versionLocations || "alembic/versions",
        file_template: payload.template || "%(rev)s_%(slug)s",
      };
      if (payload.timezone !== undefined) { base["timezone"] = payload.timezone; }
      if (payload.truncateSlug) { base["truncate_slug_length"] = payload.truncateSlug; }
      if (payload.sqlalchemyUrl !== undefined && payload.sqlalchemyUrl.trim() !== "") {
        base["sqlalchemy.url"] = payload.sqlalchemyUrl.trim();
      }
      // Only write version_path_separator if it's not the default 'os' value
      if (payload.versionPathSeparator !== undefined && payload.versionPathSeparator !== "os") {
        // Handle space separator specially - use 'space' as the value since actual space gets trimmed
        const separatorValue = payload.versionPathSeparator === " " ? "space" : payload.versionPathSeparator;
        base["version_path_separator"] = separatorValue;
      }
      if (payload.recursiveVersionLocations !== undefined) {
        base["recursive_version_locations"] = payload.recursiveVersionLocations.toString();
      }
      if (payload.revisionEnvironment !== undefined) {
        base["revision_environment"] = payload.revisionEnvironment.toString();
      }
      if (payload.prependSysPath !== undefined && payload.prependSysPath.trim() !== "") {
        base["prepend_sys_path"] = payload.prependSysPath.trim();
      }
      if (payload.sourceless !== undefined) {
        base["sourceless"] = payload.sourceless.toString();
      }
      if (payload.outputEncoding !== undefined && payload.outputEncoding.trim() !== "") {
        // Validate encoding
        const validEncodings = ["utf-8", "utf-16", "latin-1", "cp1252", "ascii"];
        const encoding = payload.outputEncoding.trim().toLowerCase();
        if (!validEncodings.includes(encoding)) {
          vscode.window.showWarningMessage(
            `Warning: "${encoding}" is not a common encoding. Supported: ${validEncodings.join(", ")}`
          );
        }
        base["output_encoding"] = payload.outputEncoding.trim();
      }
      updated = updateIniSection(updated, "alembic", base);

      // persist revision ID strategy to settings
      const strategy = payload.revIdStrategy || 'default';
      await ConfigurationManager.updateConfiguration('revisionIdStrategy', strategy);
      await ConfigurationManager.updateConfiguration('sequentialRevIdWidth', payload.seqWidth || 4);
      await ConfigurationManager.updateConfiguration('hybridHashLength', payload.hashLength || 8);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(updated, "utf8"));

      // Validate env.py existence if revision_environment is enabled
      if (payload.revisionEnvironment) {
        await this.validateEnvPy(payload.scriptLocation || "alembic");
      }

      vscode.window.showInformationMessage(
        "Revision strategy applied to alembic.ini",
      );
      if (this.panel) {
        const parsed = parseIni(updated);
        this.panel.webview.postMessage({
          command: "setIni",
          payload: { content: updated, parsed },
        });
      }
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to apply revision strategy: ${e}`);
    }
  }

  private async validatePaths(payload: {
    scriptLoc: string;
    versionLoc: string;
  }): Promise<void> {
    if (!this.panel) {
      return;
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      vscode.window.showErrorMessage("Open a workspace to validate paths");
      return;
    }
    const base = folders[0].uri;
    const join = (p: string) =>
      p && (p.startsWith("/") || p.match(/^[A-Za-z]:/))
        ? vscode.Uri.file(p)
        : vscode.Uri.joinPath(base, p);
    const exists = async (u: vscode.Uri) => {
      try {
        await vscode.workspace.fs.stat(u);
        return true;
      } catch {
        return false;
      }
    };
    const scriptOk = await exists(join(payload.scriptLoc));
    const versionOk = await exists(join(payload.versionLoc));
    const msg = `script_location: ${payload.scriptLoc} => ${
      scriptOk ? "OK" : "NOT FOUND"
    }; version_locations: ${payload.versionLoc} => ${
      versionOk ? "OK" : "NOT FOUND"
    }    `;
    vscode.window.showInformationMessage(msg);
  }

  private async validateVersionLocations(payload: {
    locations: string[];
    separator: string;
  }): Promise<void> {
    if (!this.panel) {
      return;
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      vscode.window.showErrorMessage("Open a workspace to validate paths");
      return;
    }

    const base = folders[0].uri;
    const join = (p: string) =>
      p && (p.startsWith("/") || p.match(/^[A-Za-z]:/))
        ? vscode.Uri.file(p)
        : vscode.Uri.joinPath(base, p);

    const exists = async (u: vscode.Uri) => {
      try {
        await vscode.workspace.fs.stat(u);
        return true;
      } catch {
        return false;
      }
    };

    const results: Array<{path: string; exists: boolean}> = [];
    for (const location of payload.locations) {
      if (location.trim()) {
        const locationExists = await exists(join(location.trim()));
        results.push({ path: location.trim(), exists: locationExists });
      }
    }

    const missingPaths = results.filter(r => !r.exists);

    if (missingPaths.length > 0) {
      const createChoice = await vscode.window.showWarningMessage(
        `Some version locations don't exist: ${missingPaths.map(r => r.path).join(', ')}`,
        "Create missing directories",
        "Cancel"
      );

      if (createChoice === "Create missing directories") {
        await this.createMissingDirectories(missingPaths.map(r => r.path));
      }
    } else {
      vscode.window.showInformationMessage(
        `All version locations exist (${results.length} paths validated)`
      );
    }
  }

  private async createMissingDirectories(paths: string[]): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return;
    }

    const base = folders[0].uri;
    const join = (p: string) =>
      p && (p.startsWith("/") || p.match(/^[A-Za-z]:/))
        ? vscode.Uri.file(p)
        : vscode.Uri.joinPath(base, p);

    try {
      for (const path of paths) {
        const uri = join(path);
        await vscode.workspace.fs.createDirectory(uri);
      }
      vscode.window.showInformationMessage(
        `Created ${paths.length} directories: ${paths.join(', ')}`
      );
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to create directories: ${e}`);
    }
  }

  private async validateEnvPy(scriptLocation: string): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return;
    }

    const base = folders[0].uri;
    const join = (p: string) =>
      p && (p.startsWith("/") || p.match(/^[A-Za-z]:/))
        ? vscode.Uri.file(p)
        : vscode.Uri.joinPath(base, p);

    const envPyUri = vscode.Uri.joinPath(join(scriptLocation), "env.py");

    try {
      await vscode.workspace.fs.stat(envPyUri);
    } catch {
      vscode.window.showWarningMessage(
        `revision_environment is enabled, but env.py was not found at ${scriptLocation}/env.py. ` +
        `This may cause issues when creating revisions.`
      );
    }
  }

  private async validatePrependSysPath(payload: { paths: string[] }): Promise<void> {
    if (!this.panel) {
      return;
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      vscode.window.showErrorMessage("Open a workspace to validate paths");
      return;
    }

    const base = folders[0].uri;
    const join = (p: string) =>
      p && (p.startsWith("/") || p.match(/^[A-Za-z]:/))
        ? vscode.Uri.file(p)
        : vscode.Uri.joinPath(base, p);

    const exists = async (u: vscode.Uri) => {
      try {
        await vscode.workspace.fs.stat(u);
        return true;
      } catch {
        return false;
      }
    };

    const results: Array<{ path: string; exists: boolean; isEnvVar: boolean }> = [];
    for (const path of payload.paths) {
      if (path.trim()) {
        // Check if path contains environment variable syntax
        const isEnvVar = path.includes("${") || path.includes("$");
        if (isEnvVar) {
          results.push({ path: path.trim(), exists: true, isEnvVar: true });
        } else {
          const pathExists = await exists(join(path.trim()));
          results.push({ path: path.trim(), exists: pathExists, isEnvVar: false });
        }
      }
    }

    const missingPaths = results.filter((r) => !r.exists && !r.isEnvVar);
    const envVarPaths = results.filter((r) => r.isEnvVar);

    let message = "";
    if (missingPaths.length > 0) {
      message += `Missing paths: ${missingPaths.map((r) => r.path).join(", ")}`;
    }
    if (envVarPaths.length > 0) {
      if (message) {
        message += "; ";
      }
      message += `Environment variables detected (not validated): ${envVarPaths.map((r) => r.path).join(", ")}`;
    }
    if (missingPaths.length === 0 && envVarPaths.length === 0) {
      message = `All prepend_sys_path entries exist (${results.length} paths validated)`;
    }

    if (missingPaths.length > 0) {
      const createChoice = await vscode.window.showWarningMessage(
        message,
        "Create missing directories",
        "Cancel"
      );

      if (createChoice === "Create missing directories") {
        await this.createMissingDirectories(missingPaths.map((r) => r.path));
      }
    } else {
      vscode.window.showInformationMessage(message);
    }
  }

  private async checkHookTools(payload: { tools: string[] }): Promise<void> {
    if (!payload.tools || payload.tools.length === 0) {
      vscode.window.showInformationMessage("No tools to check");
      return;
    }

    const cfg = ConfigurationManager.getConfiguration();
    const pythonPath = cfg.pythonPath || "python";

    const results: Array<{ tool: string; available: boolean }> = [];

    for (const tool of payload.tools) {
      try {
        const { execFile } = await import("child_process");
        const { promisify } = await import("util");
        const execFilePromise = promisify(execFile);

        try {
          await execFilePromise(pythonPath, ["-m", tool, "--version"]);
          results.push({ tool, available: true });
        } catch {
          // Try direct execution
          try {
            await execFilePromise(tool, ["--version"]);
            results.push({ tool, available: true });
          } catch {
            results.push({ tool, available: false });
          }
        }
      } catch {
        results.push({ tool, available: false });
      }
    }

    const available = results.filter((r) => r.available).map((r) => r.tool);
    const missing = results.filter((r) => !r.available).map((r) => r.tool);

    let message = "";
    if (available.length > 0) {
      message += `Available: ${available.join(", ")}`;
    }
    if (missing.length > 0) {
      if (message) {
        message += "; ";
      }
      message += `Missing: ${missing.join(", ")}`;
    }

    if (missing.length > 0) {
      vscode.window.showWarningMessage(message);
    } else {
      vscode.window.showInformationMessage(message || "All tools are available");
    }
  }

  private async applyHooks(payload: {
    hooks: Array<{ name: string; type: string; entrypoint: string; options: string }>;
  }): Promise<void> {
    const cfg = ConfigurationManager.getConfiguration();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return;
    }
    const uri = vscode.Uri.joinPath(folders[0].uri, cfg.configFile);

    try {
      const raw = (await vscode.workspace.fs.readFile(uri)).toString();
      let updated = this.removeHookSections(raw);

      if (payload.hooks.length > 0) {
        const hookNames = payload.hooks.map((h) => h.name).join(",");
        updated = this.updatePostWriteHooksMain(updated, hookNames);

        for (const hook of payload.hooks) {
          updated = this.updatePostWriteHookSection(updated, hook);
        }
      }

      await vscode.workspace.fs.writeFile(uri, Buffer.from(updated, "utf8"));
      vscode.window.showInformationMessage("Post-write hooks configuration updated");

      if (this.panel) {
        const { parseIni } = await import("../utils/iniEditor");
        const parsed = parseIni(updated);
        this.panel.webview.postMessage({
          command: "setIni",
          payload: { content: updated, parsed },
        });
      }
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to update hooks: ${e}`);
    }
  }

  private removeHookSections(content: string): string {
    const lines = content.split(/\r?\n/);
    const result: string[] = [];
    let inHookSection = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("[post_write_hooks")) {
        inHookSection = true;
        continue;
      }
      if (trimmed.startsWith("[") && inHookSection) {
        inHookSection = false;
      }
      if (!inHookSection) {
        result.push(line);
      }
    }

    return result.join("\n");
  }

  private updatePostWriteHooksMain(content: string, hookNames: string): string {
    const lines = content.split(/\r?\n/);
    const sectionHeader = "[post_write_hooks]";

    // Add section at the end
    if (!content.trim().endsWith("\n")) {
      content += "\n";
    }
    content += `\n${sectionHeader}\n`;
    content += `hooks = ${hookNames}\n`;

    return content;
  }

  private updatePostWriteHookSection(
    content: string,
    hook: { name: string; type: string; entrypoint: string; options: string }
  ): string {
    const sectionHeader = `[post_write_hooks.${hook.name}]`;

    content += `\n${sectionHeader}\n`;
    content += `type = ${hook.type}\n`;
    content += `entrypoint = ${hook.entrypoint}\n`;
    if (hook.options && hook.options.trim()) {
      content += `options = ${hook.options}\n`;
    }

    return content;
  }

  private async applyLogging(payload: {
    alembicLevel: string;
    sqlalchemyLevel: string;
    logToFile: boolean;
    logFilePath: string;
  }): Promise<void> {
    const cfg = ConfigurationManager.getConfiguration();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return;
    }
    const uri = vscode.Uri.joinPath(folders[0].uri, cfg.configFile);

    try {
      const raw = (await vscode.workspace.fs.readFile(uri)).toString();
      let updated = this.removeLoggingSections(raw);
      updated = this.addLoggingSections(updated, payload);

      await vscode.workspace.fs.writeFile(uri, Buffer.from(updated, "utf8"));
      vscode.window.showInformationMessage("Logging configuration updated");

      if (this.panel) {
        const { parseIni } = await import("../utils/iniEditor");
        const parsed = parseIni(updated);
        this.panel.webview.postMessage({
          command: "setIni",
          payload: { content: updated, parsed },
        });
      }
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to update logging configuration: ${e}`);
    }
  }

  private removeLoggingSections(content: string): string {
    const lines = content.split(/\r?\n/);
    const result: string[] = [];
    let inLoggingSection = false;

    for (const line of lines) {
      const trimmed = line.trim();
      // Remove all logging-related sections
      if (
        trimmed.startsWith("[loggers]") ||
        trimmed.startsWith("[handlers]") ||
        trimmed.startsWith("[formatters]") ||
        trimmed.startsWith("[logger_") ||
        trimmed.startsWith("[handler_") ||
        trimmed.startsWith("[formatter_")
      ) {
        inLoggingSection = true;
        continue;
      }
      if (trimmed.startsWith("[") && inLoggingSection) {
        inLoggingSection = false;
      }
      if (!inLoggingSection) {
        result.push(line);
      }
    }

    return result.join("\n");
  }

  private addLoggingSections(
    content: string,
    payload: { alembicLevel: string; sqlalchemyLevel: string; logToFile: boolean; logFilePath: string }
  ): string {
    if (!content.trim().endsWith("\n")) {
      content += "\n";
    }

    // Add [loggers] section
    content += "\n[loggers]\n";
    content += "keys = root,sqlalchemy,alembic\n\n";

    // Add [handlers] section
    content += "[handlers]\n";
    if (payload.logToFile) {
      content += "keys = console,file\n\n";
    } else {
      content += "keys = console\n\n";
    }

    // Add [formatters] section
    content += "[formatters]\n";
    content += "keys = generic\n\n";

    // Add [logger_root] section
    content += "[logger_root]\n";
    content += "level = WARN\n";
    content += "handlers = console\n";
    content += "qualname =\n\n";

    // Add [logger_sqlalchemy] section
    content += "[logger_sqlalchemy]\n";
    content += `level = ${payload.sqlalchemyLevel}\n`;
    content += "handlers =\n";
    content += "qualname = sqlalchemy.engine\n\n";

    // Add [logger_alembic] section
    content += "[logger_alembic]\n";
    content += `level = ${payload.alembicLevel}\n`;
    content += "handlers =\n";
    content += "qualname = alembic\n\n";

    // Add [handler_console] section
    content += "[handler_console]\n";
    content += "class = StreamHandler\n";
    content += "args = (sys.stderr,)\n";
    content += "level = NOTSET\n";
    content += "formatter = generic\n\n";

    // Add [handler_file] section if needed
    if (payload.logToFile) {
      content += "[handler_file]\n";
      content += "class = FileHandler\n";
      content += `args = ('${payload.logFilePath}', 'w')\n`;
      content += "level = NOTSET\n";
      content += "formatter = generic\n\n";

      // Update root logger to use file handler
      content = content.replace(
        "[logger_root]\nlevel = WARN\nhandlers = console\n",
        "[logger_root]\nlevel = WARN\nhandlers = console,file\n"
      );
    }

    // Add [formatter_generic] section
    content += "[formatter_generic]\n";
    content += "format = %(levelname)-5.5s [%(name)s] %(message)s\n";
    content += "datefmt = %H:%M:%S\n";

    return content;
  }

  /**
   * Applies env.py filters configuration
   */
  private async applyEnvFilters(payload: {
    includeSchemas: boolean;
    filters: Array<{
      type: "schema" | "table" | "glob" | "regex";
      pattern: string;
      mode: "include" | "exclude";
    }>;
  }): Promise<void> {
    const { EnvPyEditor } = await import("../utils/envPyEditor");
    const cfg = ConfigurationManager.getConfiguration();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return;
    }

    // Find env.py in script_location
    const iniUri = vscode.Uri.joinPath(folders[0].uri, cfg.configFile);
    let scriptLocation = "alembic";

    try {
      const raw = (await vscode.workspace.fs.readFile(iniUri)).toString();
      const match = raw.match(/^[ \t]*script_location\s*=\s*(.+)$/m);
      if (match) {
        scriptLocation = match[1].trim();
      }
    } catch (e) {
      // Use default
    }

    const envPyUri = vscode.Uri.joinPath(
      folders[0].uri,
      scriptLocation,
      "env.py",
    );

    try {
      // Validate env.py exists
      const isValid = await EnvPyEditor.validateEnvPy(envPyUri);
      if (!isValid) {
        vscode.window.showErrorMessage(
          `env.py not found or invalid at ${scriptLocation}/env.py`,
        );
        return;
      }

      // Create backup
      await EnvPyEditor.createBackup(envPyUri);

      // Apply patches
      await EnvPyEditor.patchEnvPy(envPyUri, {
        includeSchemas: payload.includeSchemas,
        filters: payload.filters,
      });

      vscode.window.showInformationMessage(
        "env.py filters applied. Backup created at env.py.backup",
      );
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to apply env.py filters: ${e}`);
    }
  }

  /**
   * Previews env.py changes before applying
   */
  private async previewEnvChanges(payload: {
    includeSchemas: boolean;
    filters: Array<{
      type: "schema" | "table" | "glob" | "regex";
      pattern: string;
      mode: "include" | "exclude";
    }>;
  }): Promise<void> {
    const { EnvPyEditor } = await import("../utils/envPyEditor");
    const cfg = ConfigurationManager.getConfiguration();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return;
    }

    // Find env.py in script_location
    const iniUri = vscode.Uri.joinPath(folders[0].uri, cfg.configFile);
    let scriptLocation = "alembic";

    try {
      const raw = (await vscode.workspace.fs.readFile(iniUri)).toString();
      const match = raw.match(/^[ \t]*script_location\s*=\s*(.+)$/m);
      if (match) {
        scriptLocation = match[1].trim();
      }
    } catch (e) {
      // Use default
    }

    const envPyUri = vscode.Uri.joinPath(
      folders[0].uri,
      scriptLocation,
      "env.py",
    );

    try {
      // Validate env.py exists
      const isValid = await EnvPyEditor.validateEnvPy(envPyUri);
      if (!isValid) {
        vscode.window.showErrorMessage(
          `env.py not found or invalid at ${scriptLocation}/env.py`,
        );
        return;
      }

      // Create a temporary preview file
      const originalContent = (
        await vscode.workspace.fs.readFile(envPyUri)
      ).toString();
      const tempUri = vscode.Uri.file(envPyUri.fsPath + ".preview");
      await vscode.workspace.fs.writeFile(
        tempUri,
        Buffer.from(originalContent, "utf8"),
      );

      // Apply patches to preview
      await EnvPyEditor.patchEnvPy(tempUri, {
        includeSchemas: payload.includeSchemas,
        filters: payload.filters,
      });

      // Open diff view
      await vscode.commands.executeCommand(
        "vscode.diff",
        envPyUri,
        tempUri,
        "env.py Changes Preview (Original ↔ New)",
      );

      // Clean up temp file after a delay
      setTimeout(async () => {
        try {
          await vscode.workspace.fs.delete(tempUri);
        } catch {
          // Ignore cleanup errors
        }
      }, 30000); // Delete after 30 seconds
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to preview env.py changes: ${e}`);
    }
  }

  /**
   * Restores env.py from backup
   */
  private async restoreEnvBackup(): Promise<void> {
    const { EnvPyEditor } = await import("../utils/envPyEditor");
    const cfg = ConfigurationManager.getConfiguration();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return;
    }

    // Find env.py in script_location
    const iniUri = vscode.Uri.joinPath(folders[0].uri, cfg.configFile);
    let scriptLocation = "alembic";

    try {
      const raw = (await vscode.workspace.fs.readFile(iniUri)).toString();
      const match = raw.match(/^[ \t]*script_location\s*=\s*(.+)$/m);
      if (match) {
        scriptLocation = match[1].trim();
      }
    } catch (e) {
      // Use default
    }

    const envPyUri = vscode.Uri.joinPath(
      folders[0].uri,
      scriptLocation,
      "env.py",
    );
    const backupUri = vscode.Uri.file(envPyUri.fsPath + ".backup");

    try {
      // Check if backup exists
      await vscode.workspace.fs.stat(backupUri);

      // Restore from backup
      await EnvPyEditor.restoreFromBackup(envPyUri, backupUri);

      vscode.window.showInformationMessage("env.py restored from backup");
    } catch (e) {
      vscode.window.showErrorMessage(
        `Failed to restore env.py from backup: ${e}. Backup file may not exist.`,
      );
    }
  }

  /**
   * Applies context.configure options to env.py
   */
  private async applyContextOptions(payload: {
    compareType: boolean;
    compareServerDefault: boolean;
    renderAsBatch: boolean;
    versionTable: string | null;
    versionTableSchema: string | null;
  }): Promise<void> {
    const { EnvPyEditor } = await import("../utils/envPyEditor");
    const cfg = ConfigurationManager.getConfiguration();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return;
    }

    // Find env.py in script_location
    const iniUri = vscode.Uri.joinPath(folders[0].uri, cfg.configFile);
    let scriptLocation = "alembic";

    try {
      const raw = (await vscode.workspace.fs.readFile(iniUri)).toString();
      const match = raw.match(/^[ \t]*script_location\s*=\s*(.+)$/m);
      if (match) {
        scriptLocation = match[1].trim();
      }
    } catch (e) {
      // Use default
    }

    const envPyUri = vscode.Uri.joinPath(
      folders[0].uri,
      scriptLocation,
      "env.py",
    );

    try {
      // Validate env.py exists
      const isValid = await EnvPyEditor.validateEnvPy(envPyUri);
      if (!isValid) {
        vscode.window.showErrorMessage(
          `env.py not found or invalid at ${scriptLocation}/env.py`,
        );
        return;
      }

      // Create backup
      await EnvPyEditor.createBackup(envPyUri);

      // Apply patches - preserve existing filters and includeSchemas
      const currentContent = (
        await vscode.workspace.fs.readFile(envPyUri)
      ).toString();

      // Parse current config to preserve existing settings
      const hasIncludeSchemas = currentContent.includes("include_schemas=True");
      const hasIncludeObject = currentContent.includes("include_object=");

      await EnvPyEditor.patchEnvPy(envPyUri, {
        includeSchemas: hasIncludeSchemas,
        filters: hasIncludeObject ? [] : [], // Filters are preserved by not removing the function
        compareType: payload.compareType,
        compareServerDefault: payload.compareServerDefault,
        renderAsBatch: payload.renderAsBatch,
        versionTable: payload.versionTable,
        versionTableSchema: payload.versionTableSchema,
      });

      vscode.window.showInformationMessage(
        "context.configure options applied. Backup created at env.py.backup",
      );
    } catch (e) {
      vscode.window.showErrorMessage(
        `Failed to apply context.configure options: ${e}`,
      );
    }
  }

  /**
   * Previews context.configure options changes
   */
  private async previewContextOptions(payload: {
    compareType: boolean;
    compareServerDefault: boolean;
    renderAsBatch: boolean;
    versionTable: string | null;
    versionTableSchema: string | null;
  }): Promise<void> {
    const { EnvPyEditor } = await import("../utils/envPyEditor");
    const cfg = ConfigurationManager.getConfiguration();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return;
    }

    // Find env.py in script_location
    const iniUri = vscode.Uri.joinPath(folders[0].uri, cfg.configFile);
    let scriptLocation = "alembic";

    try {
      const raw = (await vscode.workspace.fs.readFile(iniUri)).toString();
      const match = raw.match(/^[ \t]*script_location\s*=\s*(.+)$/m);
      if (match) {
        scriptLocation = match[1].trim();
      }
    } catch (e) {
      // Use default
    }

    const envPyUri = vscode.Uri.joinPath(
      folders[0].uri,
      scriptLocation,
      "env.py",
    );

    try {
      // Validate env.py exists
      const isValid = await EnvPyEditor.validateEnvPy(envPyUri);
      if (!isValid) {
        vscode.window.showErrorMessage(
          `env.py not found or invalid at ${scriptLocation}/env.py`,
        );
        return;
      }

      // Create a temporary preview file
      const originalContent = (
        await vscode.workspace.fs.readFile(envPyUri)
      ).toString();
      const tempUri = vscode.Uri.file(envPyUri.fsPath + ".preview");
      await vscode.workspace.fs.writeFile(
        tempUri,
        Buffer.from(originalContent, "utf8"),
      );

      // Parse current config to preserve existing settings
      const hasIncludeSchemas = originalContent.includes("include_schemas=True");
      const hasIncludeObject = originalContent.includes("include_object=");

      // Apply patches to preview
      await EnvPyEditor.patchEnvPy(tempUri, {
        includeSchemas: hasIncludeSchemas,
        filters: hasIncludeObject ? [] : [],
        compareType: payload.compareType,
        compareServerDefault: payload.compareServerDefault,
        renderAsBatch: payload.renderAsBatch,
        versionTable: payload.versionTable,
        versionTableSchema: payload.versionTableSchema,
      });

      // Open diff view
      await vscode.commands.executeCommand(
        "vscode.diff",
        envPyUri,
        tempUri,
        "context.configure Options Preview (Original ↔ New)",
      );

      // Clean up temp file after a delay
      setTimeout(async () => {
        try {
          await vscode.workspace.fs.delete(tempUri);
        } catch {
          // Ignore cleanup errors
        }
      }, 30000); // Delete after 30 seconds
    } catch (e) {
      vscode.window.showErrorMessage(
        `Failed to preview context.configure options: ${e}`,
      );
    }
  }
}
