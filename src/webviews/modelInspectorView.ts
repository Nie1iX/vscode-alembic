import * as vscode from "vscode";

export class ModelInspectorWebview {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private context: vscode.ExtensionContext) {}

  public show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    this.panel = vscode.window.createWebviewPanel(
      "alembicModels",
      "Alembic Models",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panel.webview.html = this.html("Waiting for data...");
  }

  public update(data: {
    visible: string[];
    hidden: string[];
    errors: string[];
  }): void {
    if (!this.panel) {
      this.show();
    }
    if (!this.panel) {
      return;
    }
    const html = this.html("", data);
    this.panel.webview.html = html;
  }

  private html(
    status: string,
    data?: { visible: string[]; hidden: string[]; errors: string[] },
  ): string {
    const visible = data?.visible || [];
    const hidden = data?.hidden || [];
    const errors = data?.errors || [];
    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Alembic Models</title>
  <style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  .wrap { padding: 12px 16px; }
  h2 { margin-top: 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card { border: 1px solid var(--vscode-panel-border); background: var(--vscode-panel-background); border-radius: 4px; padding: 12px; }
  ul { margin: 0; padding-left: 18px; }
  .muted { color: var(--vscode-descriptionForeground); }
  </style>
  </head>
  <body>
    <div class="wrap">
      <h2>Alembic Model Visibility</h2>
      ${status ? `<div class="muted">${escape(status)}</div>` : ""}
      <div class="grid">
        <div class="card">
          <h3>Visible (${visible.length})</h3>
          ${
            visible.length
              ? `<ul>${visible
                  .map((v) => `<li>${escape(v)}</li>`)
                  .join("")}</ul>`
              : '<div class="muted">No visible models found.</div>'
          }
        </div>
        <div class="card">
          <h3>Hidden (${hidden.length})</h3>
          ${
            hidden.length
              ? `<ul>${hidden
                  .map((v) => `<li>${escape(v)}</li>`)
                  .join("")}</ul>`
              : '<div class="muted">No hidden models.</div>'
          }
        </div>
      </div>
      ${
        errors.length
          ? `<div class="card"><h3>Errors</h3><ul>${errors
              .map((e) => `<li>${escape(e)}</li>`)
              .join("")}</ul></div>`
          : ""
      }
    </div>
  </body>
  </html>`;
  }
}
