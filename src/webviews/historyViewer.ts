import * as vscode from "vscode";
import { AlembicService } from "../services/alembicService";
import * as path from "path";

export class HistoryViewerWebview {
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
      "alembicHistory",
      "Alembic History",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    this.panel.webview.html = await this.getWebviewContentFromTemplate();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "ready":
          await this.loadHistory();
          break;
        case "loadHistory":
          await this.loadHistory(message.range, message.verbose);
          break;
        case "loadHeads":
          await this.loadHeads();
          break;
        case "loadBranches":
          await this.loadBranches();
          break;
        case "showRevision":
          await this.showRevision(message.id);
          break;
        case "openFile":
          await this.alembicService.openMigrationFile(message.id);
          break;
        case "copyCommand":
          await vscode.env.clipboard.writeText(message.text);
          vscode.window.showInformationMessage("Command copied to clipboard");
          break;
      }
    });

    // Clean up when panel is closed
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private async loadHistory(range?: string, verbose: boolean = true): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      const historyData = await this.alembicService.getHistory(range, verbose);
      this.panel.webview.postMessage({
        command: "updateHistory",
        data: historyData,
      });
    } catch (error) {
      console.error("Failed to load history:", error);
      vscode.window.showErrorMessage(
        `Failed to load history: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async loadHeads(): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      const headsData = await this.alembicService.getHeads();
      this.panel.webview.postMessage({
        command: "updateHeads",
        data: headsData,
      });
    } catch (error) {
      console.error("Failed to load heads:", error);
      vscode.window.showErrorMessage(
        `Failed to load heads: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async loadBranches(): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      const branchesData = await this.alembicService.getBranches();
      this.panel.webview.postMessage({
        command: "updateBranches",
        data: branchesData,
      });
    } catch (error) {
      console.error("Failed to load branches:", error);
      vscode.window.showErrorMessage(
        `Failed to load branches: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async showRevision(id: string): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      const revisionData = await this.alembicService.showRevision(id);
      this.panel.webview.postMessage({
        command: "updateRevisionDetail",
        data: revisionData,
      });
    } catch (error) {
      console.error("Failed to show revision:", error);
      vscode.window.showErrorMessage(
        `Failed to show revision: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async getWebviewContentFromTemplate(): Promise<string> {
    const htmlPath = path.join(
      this.context.extensionPath,
      "media",
      "historyViewer.html",
    );
    const htmlUri = vscode.Uri.file(htmlPath);
    const htmlContent = await vscode.workspace.fs.readFile(htmlUri);
    return htmlContent.toString();
  }
}
