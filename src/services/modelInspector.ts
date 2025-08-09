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
      const pyScript = this.buildInspectorPython();
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

  private buildInspectorPython(): string {
    // A small python that loads alembic env and compares declared models vs target_metadata tables
    return `
import json, sys, importlib.util
from pathlib import Path
import os

def load_env(config_path):
    # Try to load env.py relative to config
    cfg_dir = Path(config_path).resolve().parent
    # search for 'alembic' dir containing env.py
    candidates = [cfg_dir/'alembic'/'env.py', cfg_dir/'env.py']
    for p in candidates:
        if p.exists():
            spec = importlib.util.spec_from_file_location('alembic_env', str(p))
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            return mod
    raise FileNotFoundError('env.py not found near alembic.ini')

def get_target_metadata(mod):
    # Common patterns: env.target_metadata or run_migrations_offline/online references
    if hasattr(mod, 'target_metadata') and mod.target_metadata is not None:
        return mod.target_metadata
    # try to dig in globals
    for k, v in vars(mod).items():
        if k.endswith('metadata') and getattr(v, 'tables', None) is not None:
            return v
    return None

def list_declared_models():
    # best-effort: import SQLAlchemy and iterate over Base subclasses if present
    try:
        from sqlalchemy.orm import DeclarativeMeta
        subclasses = set()
        for cls in DeclarativeMeta.__subclasses__():
            try:
                if getattr(cls, '__tablename__', None):
                    subclasses.add(cls)
            except Exception:
                pass
        return sorted({f"{c.__module__}.{c.__name__}" for c in subclasses})
    except Exception:
        return []

def main():
    # params: script.py -c alembic.ini
    cfg = None
    args = sys.argv[1:]
    for i in range(len(args)):
        if args[i] == '-c' and i+1 < len(args):
            cfg = args[i+1]
            break
    if not cfg:
        print(json.dumps({'errors':['no -c config']}))
        return
    try:
        env_mod = load_env(cfg)
    except Exception as e:
        print(json.dumps({'errors':[str(e)]}))
        return
    md = get_target_metadata(env_mod)
    visible = []
    if md is not None:
        visible = sorted(list(md.tables.keys()))
    declared = list_declared_models()
    # hidden models: declared classes whose __tablename__ not in target md
    hidden = []
    for qual in declared:
        try:
            mod_name, cls_name = qual.rsplit('.', 1)
            mod = __import__(mod_name, fromlist=[cls_name])
            cls = getattr(mod, cls_name)
            tn = getattr(cls, '__tablename__', None)
            if tn and (md is None or tn not in md.tables):
                hidden.append(f"{qual} (table: {tn})")
        except Exception:
            pass
    print(json.dumps({'visible_models': visible, 'hidden_models': hidden, 'errors': []}))

if __name__ == '__main__':
    # allow VSCode to pass PYTHONPATH
    ws = os.environ.get('VSCODE_WORKSPACE')
    if ws and ws not in sys.path:
        sys.path.insert(0, ws)
    main()
`;
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
