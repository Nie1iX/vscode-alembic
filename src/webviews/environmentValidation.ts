import * as vscode from "vscode";
import {
  EnvironmentValidator,
  ValidationResult,
} from "../services/environmentValidator";
import { AlembicService } from "../services/alembicService";
import * as path from "path";

export class EnvironmentValidationWebview {
  private panel: vscode.WebviewPanel | undefined;
  private validator: EnvironmentValidator;

  constructor(
    private context: vscode.ExtensionContext,
    alembicService: AlembicService,
  ) {
    this.validator = new EnvironmentValidator(alembicService);
  }

  public async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      await this.runValidation();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "alembicValidation",
      "Environment Validation",
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
          await this.runValidation();
          break;
        case "refresh":
          await this.runValidation();
          break;
        case "runFix":
          await this.runFix(message.index);
          break;
      }
    });

    // Clean up when panel is closed
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private currentResult: ValidationResult | undefined;

  private async runValidation(): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      this.panel.webview.postMessage({ command: "validationStarted" });

      const result = await this.validator.validate();
      this.currentResult = result;

      this.panel.webview.postMessage({
        command: "validationComplete",
        result,
      });
    } catch (error) {
      console.error("Validation failed:", error);
      vscode.window.showErrorMessage(
        `Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async runFix(index: number): Promise<void> {
    if (!this.currentResult) {
      return;
    }

    const issue = this.currentResult.issues[index];
    if (issue && issue.fix) {
      try {
        await issue.fix.action();
        // Re-run validation after fix
        setTimeout(() => this.runValidation(), 500);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Fix failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  }

  private async getWebviewContentFromTemplate(): Promise<string> {
    const htmlPath = path.join(
      this.context.extensionPath,
      "media",
      "environmentValidation.html",
    );
    const htmlUri = vscode.Uri.file(htmlPath);
    const htmlContent = await vscode.workspace.fs.readFile(htmlUri);
    return htmlContent.toString();
  }
}
