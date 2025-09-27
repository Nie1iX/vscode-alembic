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
    timezone?: string;
    truncateSlug?: string;
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
      updated = updateIniSection(updated, "alembic", base);

      // persist revision ID strategy to settings
      const strategy = payload.revIdStrategy || 'default';
      await ConfigurationManager.updateConfiguration('revisionIdStrategy', strategy);
      await ConfigurationManager.updateConfiguration('sequentialRevIdWidth', payload.seqWidth || 4);
      await ConfigurationManager.updateConfiguration('hybridHashLength', payload.hashLength || 8);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(updated, "utf8"));
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
}
