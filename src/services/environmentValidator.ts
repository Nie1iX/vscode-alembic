import * as vscode from "vscode";
import * as path from "path";
import { AlembicService } from "./alembicService";
import { ConfigurationManager } from "../config/configurationManager";

export interface ValidationIssue {
  category: "error" | "warning" | "info";
  message: string;
  fix?: {
    label: string;
    action: () => Promise<void>;
  };
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

export class EnvironmentValidator {
  constructor(private alembicService: AlembicService) {}

  async validate(): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // Check Python interpreter
    await this.checkPython(issues);

    // Check Alembic installation
    await this.checkAlembic(issues);

    // Check alembic.ini
    await this.checkAlembicIni(issues);

    // Check env.py
    await this.checkEnvPy(issues);

    // Check script_location and version_locations
    await this.checkVersionDirectories(issues);

    // Check post_write_hooks tools
    await this.checkPostWriteHooks(issues);

    // Check for multiple heads
    await this.checkMultipleHeads(issues);

    const summary = {
      errors: issues.filter((i) => i.category === "error").length,
      warnings: issues.filter((i) => i.category === "warning").length,
      info: issues.filter((i) => i.category === "info").length,
    };

    return {
      passed: summary.errors === 0,
      issues,
      summary,
    };
  }

  private async checkPython(issues: ValidationIssue[]): Promise<void> {
    const config = ConfigurationManager.getConfiguration();
    const pythonPath = config.pythonPath || "python";

    try {
      const { spawn } = require("child_process");
      const result = await new Promise<{ code: number; output: string }>(
        (resolve) => {
          const proc = spawn(pythonPath, ["--version"], { shell: true });
          let output = "";

          proc.stdout.on("data", (data: Buffer) => {
            output += data.toString();
          });
          proc.stderr.on("data", (data: Buffer) => {
            output += data.toString();
          });

          proc.on("close", (code: number) => {
            resolve({ code, output });
          });

          proc.on("error", () => {
            resolve({ code: 1, output: "" });
          });
        },
      );

      if (result.code === 0) {
        issues.push({
          category: "info",
          message: `✓ Python found: ${result.output.trim()} (${pythonPath})`,
        });
      } else {
        issues.push({
          category: "error",
          message: `✗ Python interpreter not found at: ${pythonPath}`,
          fix: {
            label: "Select Python Interpreter",
            action: async () => {
              await vscode.commands.executeCommand("alembic.selectPython");
            },
          },
        });
      }
    } catch (error) {
      issues.push({
        category: "error",
        message: `✗ Failed to check Python: ${error}`,
      });
    }
  }

  private async checkAlembic(issues: ValidationIssue[]): Promise<void> {
    try {
      const version = await this.alembicService.getAlembicVersion();
      if (version) {
        issues.push({
          category: "info",
          message: `✓ Alembic installed: ${version}`,
        });
      } else {
        issues.push({
          category: "error",
          message: "✗ Alembic not found or not accessible",
        });
      }
    } catch (error) {
      issues.push({
        category: "error",
        message: "✗ Alembic not found or not accessible",
      });
    }
  }

  private async checkAlembicIni(issues: ValidationIssue[]): Promise<void> {
    const config = ConfigurationManager.getConfiguration();
    const workspaceFolder = this.getWorkspaceFolder();

    if (!workspaceFolder) {
      issues.push({
        category: "error",
        message: "✗ No workspace folder open",
      });
      return;
    }

    const iniPath = path.join(workspaceFolder, config.configFile);
    const iniUri = vscode.Uri.file(iniPath);

    try {
      await vscode.workspace.fs.stat(iniUri);
      issues.push({
        category: "info",
        message: `✓ Configuration file found: ${config.configFile}`,
      });
    } catch {
      issues.push({
        category: "error",
        message: `✗ Configuration file not found: ${config.configFile}`,
        fix: {
          label: "Initialize Alembic",
          action: async () => {
            await vscode.commands.executeCommand("alembic.init");
          },
        },
      });
    }
  }

  private async checkEnvPy(issues: ValidationIssue[]): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) {
      return;
    }

    // Try common locations
    const possiblePaths = [
      path.join(workspaceFolder, "alembic", "env.py"),
      path.join(workspaceFolder, "migrations", "env.py"),
    ];

    let found = false;
    for (const envPath of possiblePaths) {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(envPath));
        issues.push({
          category: "info",
          message: `✓ env.py found: ${path.relative(workspaceFolder, envPath)}`,
        });
        found = true;
        break;
      } catch {
        // Continue checking
      }
    }

    if (!found) {
      issues.push({
        category: "warning",
        message: "⚠ env.py not found in common locations (alembic/env.py, migrations/env.py)",
      });
    }
  }

  private async checkVersionDirectories(
    issues: ValidationIssue[],
  ): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) {
      return;
    }

    // Try common version locations
    const possiblePaths = [
      path.join(workspaceFolder, "alembic", "versions"),
      path.join(workspaceFolder, "migrations", "versions"),
    ];

    let found = false;
    for (const versionsPath of possiblePaths) {
      try {
        const stat = await vscode.workspace.fs.stat(
          vscode.Uri.file(versionsPath),
        );
        if (stat.type === vscode.FileType.Directory) {
          issues.push({
            category: "info",
            message: `✓ Versions directory found: ${path.relative(workspaceFolder, versionsPath)}`,
          });
          found = true;
          break;
        }
      } catch {
        // Continue checking
      }
    }

    if (!found) {
      issues.push({
        category: "warning",
        message: "⚠ Versions directory not found in common locations",
      });
    }
  }

  private async checkPostWriteHooks(issues: ValidationIssue[]): Promise<void> {
    // Read alembic.ini and check for post_write_hooks
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) {
      return;
    }

    const config = ConfigurationManager.getConfiguration();
    const iniPath = path.join(workspaceFolder, config.configFile);

    try {
      const iniContent = await vscode.workspace.fs.readFile(
        vscode.Uri.file(iniPath),
      );
      const iniText = iniContent.toString();

      const hasHooks = iniText.includes("[post_write_hooks]");
      if (hasHooks) {
        // Extract hook types and check if tools are available
        const hookMatches = iniText.matchAll(/^(\w+)\.type\s*=\s*(\w+)$/gm);
        const tools = new Set<string>();

        for (const match of hookMatches) {
          const hookType = match[2];
          if (
            ["black", "ruff", "autopep8", "isort", "zimports"].includes(
              hookType,
            )
          ) {
            tools.add(hookType);
          }
        }

        for (const tool of tools) {
          await this.checkTool(tool, issues);
        }

        if (tools.size === 0) {
          issues.push({
            category: "info",
            message: "ⓘ Post-write hooks configured (custom/console)",
          });
        }
      }
    } catch {
      // Ini not found, already reported
    }
  }

  private async checkTool(
    tool: string,
    issues: ValidationIssue[],
  ): Promise<void> {
    try {
      const { spawn } = require("child_process");
      const result = await new Promise<number>((resolve) => {
        const proc = spawn(tool, ["--version"], { shell: true });

        proc.on("close", (code: number) => {
          resolve(code);
        });

        proc.on("error", () => {
          resolve(1);
        });
      });

      if (result === 0) {
        issues.push({
          category: "info",
          message: `✓ Post-write hook tool found: ${tool}`,
        });
      } else {
        issues.push({
          category: "warning",
          message: `⚠ Post-write hook tool not found: ${tool}`,
        });
      }
    } catch {
      issues.push({
        category: "warning",
        message: `⚠ Post-write hook tool not found: ${tool}`,
      });
    }
  }

  private async checkMultipleHeads(issues: ValidationIssue[]): Promise<void> {
    try {
      const headsOutput = await this.alembicService.getHeads();
      const lines = headsOutput
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length > 1) {
        issues.push({
          category: "warning",
          message: `⚠ Multiple heads detected (${lines.length} heads)`,
          fix: {
            label: "Merge Branches",
            action: async () => {
              await vscode.commands.executeCommand("alembic.mergeBranches");
            },
          },
        });
      } else if (lines.length === 1) {
        issues.push({
          category: "info",
          message: "✓ Single head (no merge needed)",
        });
      }
    } catch (error) {
      // Heads command failed - might be no database connection
      issues.push({
        category: "info",
        message: "ⓘ Could not check heads (database might not be accessible)",
      });
    }
  }

  private getWorkspaceFolder(): string | undefined {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
      return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    return undefined;
  }
}
