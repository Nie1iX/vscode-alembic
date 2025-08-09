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

    this.panel.webview.html = await this.getHtml();

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
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private async getHtml(): Promise<string> {
    const config = ConfigurationManager.getConfiguration();
    const nonce = String(Date.now());
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${
    this.panel?.webview.cspSource
  }; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Alembic Settings</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; }
    .container { padding: 12px 16px; }
    .row { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
    .section { border: 1px solid var(--vscode-panel-border); background: var(--vscode-panel-background); padding: 12px; border-radius: 4px; margin-bottom: 12px; }
    label { width: 220px; color: var(--vscode-descriptionForeground); }
    input, select, textarea { width: 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 6px 8px; border-radius: 3px; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 0; padding: 6px 10px; border-radius: 3px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .actions { display: flex; gap: 10px; }
    .help { font-size: 12px; color: var(--vscode-descriptionForeground); }
    .grid { display: grid; grid-template-columns: 240px 1fr; gap: 10px; align-items: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="section">
      <div class="row"><strong>alembic.ini editor</strong></div>
      <div class="grid">
        <label>File naming template</label>
        <div>
          <select id="fileTemplate">
            <option value="%(rev)s_%(slug)s">default: %(rev)s_%(slug)s</option>
            <option value="%(year)d_%(month).2d_%(day).2d_%(hour).2d%(minute).2d-%(rev)s_%(slug)s">date_rev_slug</option>
            <option value="%(year)d_%(month).2d_%(day).2d_%(slug)s">date_slug</option>
            <option value="%(rev)s-%(slug)s">rev-slug-dash</option>
            <option value="%(rev)s">rev-only</option>
          </select>
          <div class="help">Задаёт шаблон имени файла (file_template). Не меняет сам revision id.</div>
        </div>

        <label>Sequential rev-id (experimental)</label>
        <div>
          <label style="width:auto; display:inline-flex; align-items:center; gap:8px;">
            <input id="seqEnabled" type="checkbox" /> enable
          </label>
          <input id="seqWidth" style="max-width:100px; margin-left:8px;" type="number" min="1" max="32" value="4" />
          <div class="help">При включении будет подставляться --rev-id (0001, 0002, ...). Иначе используется стандартный хэш Alembic.</div>
        </div>

        <label>script_location</label>
        <input id="scriptLocation" type="text" placeholder="alembic" />

        <label>version_locations</label>
        <input id="versionLocations" type="text" placeholder="alembic/versions" />

        <label>timezone</label>
        <input id="timezone" type="text" placeholder="e.g. Europe/Berlin or leave blank" />

        <label>truncate_slug_length</label>
        <input id="truncateSlug" type="number" min="1" max="200" placeholder="40" />
      </div>
      <div class="actions" style="margin-top:10px;">
        <button onclick="applyTemplate()">Apply template</button>
        <button onclick="presetDefault()">Preset: default</button>
        <button onclick="presetDateRevSlug()">Preset: date_rev_slug</button>
        <button onclick="validatePaths()">Validate paths</button>
        <button onclick="saveIni()">Save</button>
      </div>
      <div class="help">Конкретные ключи alembic.ini будут обновлены без удаления комментариев.</div>
    </div>

    <div class="section">
      <div class="row"><strong>Raw alembic.ini</strong></div>
      <textarea id="raw" rows="24" spellcheck="false"></textarea>
      <div class="actions" style="margin-top:10px;"><button onclick="reloadIni()">Reload</button></div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const cfg = ${JSON.stringify(config)};
    window.addEventListener('message', (e) => {
      const { command, payload } = e.data || {};
      if (command === 'setIni') {
        document.getElementById('raw').value = payload.content || '';
        if (payload.parsed) {
          const s = payload.parsed;
          // seed UI from parsed values when possible
          document.getElementById('fileTemplate').value = (s['alembic'] && s['alembic']['file_template']) || '%(rev)s_%(slug)s';
          document.getElementById('seqEnabled').checked = localStorage.getItem('seqEnabled') === 'true';
          document.getElementById('seqWidth').value = localStorage.getItem('seqWidth') || '4';
          document.getElementById('scriptLocation').value = (s['alembic'] && (s['alembic']['script_location'] || s['alembic']['script_location '])) || 'alembic';
          document.getElementById('versionLocations').value = (s['alembic'] && s['alembic']['version_locations']) || '';
          document.getElementById('timezone').value = (s['alembic'] && s['alembic']['timezone']) || '';
          document.getElementById('truncateSlug').value = (s['alembic'] && s['alembic']['truncate_slug_length']) || '';
        }
      }
    });

    function reloadIni() { vscode.postMessage({ command: 'load' }); }
    function saveIni() {
      vscode.postMessage({ command: 'save', payload: { content: document.getElementById('raw').value } });
    }
    function applyTemplate() {
      const template = document.getElementById('fileTemplate').value;
      const seqEnabled = document.getElementById('seqEnabled').checked;
      const seqWidth = parseInt(document.getElementById('seqWidth').value || '4', 10);
      localStorage.setItem('seqEnabled', String(seqEnabled));
      localStorage.setItem('seqWidth', String(seqWidth));
      const scriptLocation = document.getElementById('scriptLocation').value;
      const versionLocations = document.getElementById('versionLocations').value;
      const timezone = document.getElementById('timezone').value;
      const truncateSlug = document.getElementById('truncateSlug').value;
      vscode.postMessage({ command: 'applyRevisionStrategy', payload: { template, seqEnabled, seqWidth, scriptLocation, versionLocations, timezone, truncateSlug } });
    }
    function presetDefault() {
      document.getElementById('fileTemplate').value = '%(rev)s_%(slug)s';
      applyTemplate();
    }
    function presetDateRevSlug() {
      document.getElementById('fileTemplate').value = '%(year)d_%(month).2d_%(day).2d_%(hour).2d%(minute).2d-%(rev)s_%(slug)s';
      applyTemplate();
    }
    function validatePaths() {
      const raw = document.getElementById('raw').value;
      let scriptLoc = 'alembic';
      let versionLoc = 'alembic/versions';
      const m1 = raw.match(/^[ \t]*script_location\s*=\s*(.+)$/m);
      if (m1) { scriptLoc = m1[1].trim(); }
      const m2 = raw.match(/^[ \t]*version_locations\s*=\s*(.+)$/m);
      if (m2) { versionLoc = m2[1].trim(); }
      vscode.postMessage({ command: 'validatePaths', payload: { scriptLoc, versionLoc } });
    }

    // initial load
    reloadIni();
  </script>
</body>
</html>
    `;
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
    seqEnabled: boolean;
    seqWidth: number;
    scriptLocation?: string;
    versionLocations?: string;
    timezone?: string;
    truncateSlug?: string;
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
      updated = updateIniSection(updated, "alembic", base);
      // persist experimental sequential toggle to settings
      await ConfigurationManager.updateConfiguration('sequentialRevIdEnabled', !!payload.seqEnabled);
      await ConfigurationManager.updateConfiguration('sequentialRevIdWidth', payload.seqWidth || 4);
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
    }`;
    vscode.window.showInformationMessage(msg);
  }
}
