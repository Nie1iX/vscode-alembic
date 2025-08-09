import * as vscode from "vscode";

export class ModelInspectorWebview {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private context: vscode.ExtensionContext) {}

  public get extensionContext(): vscode.ExtensionContext {
    return this.context;
  }

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
    // load initial template with status
    this.setHtmlFromTemplate("Waiting for data...");
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
    this.setHtmlFromTemplate("", data);
  }

  private async setHtmlFromTemplate(
    status: string,
    data?: { visible: string[]; hidden: string[]; errors: string[] },
  ): Promise<void> {
    const webview = this.panel!.webview;
    const nonce = String(Date.now());
    const visible = data?.visible || [];
    const hidden = data?.hidden || [];
    const errors = data?.errors || [];
    const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const tplUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      "modelInspector.html",
    );
    const buf = await vscode.workspace.fs.readFile(tplUri);
    const tpl = Buffer.from(buf).toString("utf8");
    const visibleList = visible.length
      ? `<ul>${visible.map((v) => `<li>${escape(v)}</li>`).join("")}</ul>`
      : '<div class="muted">No visible models found.</div>';
    const hiddenList = hidden.length
      ? `<ul>${hidden.map((v) => `<li>${escape(v)}</li>`).join("")}</ul>`
      : '<div class="muted">No hidden models.</div>';
    const errorsSection = errors.length
      ? `<div class="card"><h3>Errors</h3><ul>${errors
          .map((e) => `<li>${escape(e)}</li>`)
          .join("")}</ul></div>`
      : "";
    let html = tpl
      .replace(/__NONCE__/g, nonce)
      .replace(/__CSP_SOURCE__/g, webview.cspSource)
      .replace(/__STATUS__/g, status ? `<div class="muted">${escape(status)}</div>` : "")
      .replace(/__VISIBLE_COUNT__/g, String(visible.length))
      .replace(/__HIDDEN_COUNT__/g, String(hidden.length))
      .replace(/__VISIBLE_LIST__/g, visibleList)
      .replace(/__HIDDEN_LIST__/g, hiddenList)
      .replace(/__ERRORS_SECTION__/g, errorsSection);
    this.panel!.webview.html = html;
  }
}
