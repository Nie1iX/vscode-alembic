import * as vscode from "vscode";
import { AlembicService } from "../services/alembicService";

export class MigrationGraphWebview {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private alembicService: AlembicService,
  ) {}

  public async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "migrationGraph",
      "Migration Graph",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    this.panel.webview.html = await this.getWebviewContentFromTemplate();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(async (message) => {
      try {
        switch (message.command) {
          case "ready":
            await this.updateGraph();
            break;
          case "refresh":
            await this.updateGraph();
            break;
          case "upgradeHead":
            await this.alembicService.upgrade("head");
            await this.updateGraph();
            break;
          case "upgrade":
            await this.alembicService.upgrade(message.id);
            await this.updateGraph();
            break;
          case "downgrade":
            await this.alembicService.downgrade(message.id);
            await this.updateGraph();
            break;
          case "merge":
            await this.alembicService.mergeBranches(message.id);
            await this.updateGraph();
            break;
          case "openFile":
            await this.alembicService.openMigrationFile(message.id);
            break;
        }
      } catch (error) {
        this.panel?.webview.postMessage({
          command: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Clean up when panel is closed
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private async updateGraph(): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      const graphData = await this.alembicService.getMigrationGraph();
      this.panel.webview.postMessage({
        command: "updateGraph",
        data: graphData,
      });
    } catch (error) {
      console.error("Failed to update graph:", error);
      vscode.window.showErrorMessage(
        `Failed to load migration graph: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }


  private async getWebviewContentFromTemplate(): Promise<string> {
    const webview = this.panel!.webview;
    const nonce = String(Date.now());
    const templateUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      "migrationGraph.html",
    );
    const visUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "vis-network.min.js",
      ),
    );
    const raw = await vscode.workspace.fs.readFile(templateUri);
    let html = Buffer.from(raw).toString("utf8");
    html = html
      .replace(/__NONCE__/g, nonce)
      .replace(/__VIS_JS__/g, String(visUri))
      .replace(/__CSP_SOURCE__/g, webview.cspSource);
    return html;
  }
}
