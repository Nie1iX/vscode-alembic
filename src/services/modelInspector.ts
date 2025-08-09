import * as vscode from "vscode";
import { ConfigurationManager } from "../config/configurationManager";
import { ModelInspectorWebview } from "../webviews/modelInspectorView";

export class ModelInspector {
  private output: vscode.OutputChannel;
  private view: ModelInspectorWebview | undefined;

  constructor() {
    this.output = vscode.window.createOutputChannel("Alembic Models");
  }

  async inspectAndReport(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("Open a workspace to inspect models");
      return;
    }

    const config = ConfigurationManager.getConfiguration();
    const cfgUri = vscode.Uri.joinPath(workspaceFolder, config.configFile);

    try {
      const pyScript = await this.loadInspectorPython();
      const tmp = await this.writeTempScript(pyScript);
      try {
        const result = await this.execPython([tmp, "-c", config.configFile]);
        const payload = JSON.parse(result);
        this.renderReport(payload);
        this.updateWebview(payload);
      } finally {
        await vscode.workspace.fs.delete(vscode.Uri.file(tmp));
      }
    } catch (e) {
      this.output.appendLine(String(e));
      this.output.show();
      vscode.window.showErrorMessage(
        "Failed to inspect models (see Alembic Models output)",
      );
    }
  }

  private renderReport(payload: any) {
    this.output.clear();
    this.output.appendLine("=== Alembic Model Visibility Report ===");
    if (!payload || typeof payload !== "object") {
      this.output.appendLine("Invalid payload");
      this.output.show();
      return;
    }
    const { visible_models = [], hidden_models = [], errors = [] } = payload;
    this.output.appendLine("Visible models count: " + visible_models.length);
    this.output.appendLine("Hidden models count: " + hidden_models.length);
    if (hidden_models.length) {
      this.output.appendLine(
        "Hidden models (not reachable via target_metadata):",
      );
      for (const m of hidden_models) {
        this.output.appendLine("  - " + m);
      }
    }
    if (errors.length) {
      this.output.appendLine("Errors:");
      for (const e of errors) {
        this.output.appendLine("  - " + e);
      }
    }
    this.output.show();
  }

  public attachWebview(view: ModelInspectorWebview) {
    this.view = view;
  }

  private updateWebview(payload: any) {
    const data = {
      visible: payload?.visible_models || [],
      hidden: payload?.hidden_models || [],
      errors: payload?.errors || [],
    };
    if (!this.view) {
      this.view = new ModelInspectorWebview({} as vscode.ExtensionContext);
      this.view.show();
    }
    this.view.update(data);
  }

  private async loadInspectorPython(): Promise<string> {
    const ctx = this.view?.extensionContext;
    if (!ctx) {
      throw new Error("No extension context for inspector script");
    }
    const uri = vscode.Uri.joinPath(ctx.extensionUri, "resources", "inspector.py");
    const buf = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(buf).toString("utf8");
  }

  private async writeTempScript(content: string): Promise<string> {
    const os = require("os");
    const path = require("path");
    const fs = require("fs");
    const file = path.join(
      os.tmpdir(),
      `vscode-alembic-inspect-${Date.now()}.py`,
    );
    fs.writeFileSync(file, content, "utf8");
    return file;
  }

  private async execPython(args: string[]): Promise<string> {
    const config = ConfigurationManager.getConfiguration();
    return new Promise((resolve, reject) => {
      const { spawn } = require("child_process");
      const proc = spawn(config.pythonPath, args, {
        shell: true,
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        env: {
          ...process.env,
          VSCODE_WORKSPACE:
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "",
        },
      });
      let out = "";
      let err = "";
      proc.stdout.on("data", (d: Buffer) => {
        out += d.toString();
      });
      proc.stderr.on("data", (d: Buffer) => {
        err += d.toString();
      });
      proc.on("close", (code: number) => {
        if (code === 0) {
          resolve(out.trim());
        } else {
          reject(new Error(err || `python exited ${code}`));
        }
      });
      proc.on("error", (e: any) => {
        reject(e);
      });
    });
  }
}
