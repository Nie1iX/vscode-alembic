import * as vscode from "vscode";
import * as path from "path";
import { Migration, MigrationHistory } from "../models/migration";
import { ConfigurationManager } from "../config/configurationManager";
import { AlembicUtils } from "../utils/alembicUtils";

export class AlembicService {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("Alembic");
  }

  async getAlembicVersion(): Promise<string | undefined> {
    try {
      const command = this.buildCommand(["--version"]);
      const output = await this.executeCommand(command);
      return output.trim();
    } catch (error) {
      this.outputChannel.appendLine(`Could not get Alembic version: ${error}`);
      return undefined;
    }
  }

  async initAlembic(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("Please open a workspace folder first");
      return;
    }

    // Get and display Alembic version
    const version = await this.getAlembicVersion();
    if (version) {
      this.outputChannel.appendLine(`Using Alembic version: ${version}`);
    }

    const template = await this.askForTemplate();
    if (!template) {
      return;
    }

    const directoryName = await this.askForDirectoryName();
    if (!directoryName) {
      return;
    }

    try {
      const command = this.buildCommand([
        "init",
        "--template",
        template,
        directoryName,
      ]);
      await this.executeCommand(command, workspaceFolder);
      vscode.window.showInformationMessage("Alembic initialized successfully!");
      vscode.commands.executeCommand(
        "setContext",
        "alembic:hasAlembicConfig",
        true,
      );
    } catch (error) {
      this.showError("Failed to initialize Alembic", error);
    }
  }

  async createMigration(): Promise<void> {
    const message = await vscode.window.showInputBox({
      prompt: "Enter migration message",
      placeHolder: "e.g., add users table",
    });

    if (!message) {
      return;
    }

    try {
      const args = ["revision", "--autogenerate", "-m", message];
      const cfg = ConfigurationManager.getConfiguration();
      // Support custom revision id strategies via our [vscode-alembic] section in ini
      if (cfg.sequentialRevIdEnabled) {
        const width = cfg.sequentialRevIdWidth ?? 4;
        // Implement sequential id by passing a custom env var consumed by our filename template hook
        // If project does not have hook, fallback to --rev-id with next number computed from filesystem
        const nextId = await this.computeNextSequentialId(width).catch(
          () => undefined,
        );
        if (nextId) {
          args.push("--rev-id", nextId);
        }
      }
      const command = this.buildCommand(args);
      await this.executeCommand(command);
      vscode.window.showInformationMessage(
        `Migration "${message}" created successfully!`,
      );
      vscode.commands.executeCommand("alembic.refreshMigrations");
    } catch (error) {
      this.showError("Failed to create migration", error);
    }
  }

  private async computeNextSequentialId(width: number): Promise<string> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error("No workspace");
    }
    const cfg = ConfigurationManager.getConfiguration();
    const fs = require("fs");
    const path = require("path");
    // Try read version_locations or default folder
    const versionsDir = await this.resolveVersionsDir(workspaceFolder);
    const files = fs.existsSync(versionsDir) ? fs.readdirSync(versionsDir) : [];
    const numbers: number[] = [];
    for (const f of files) {
      const m = f.match(/^(\d{1,})_.+\.py$/);
      if (m) {
        numbers.push(parseInt(m[1], 10));
      }
    }
    const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
    return next.toString().padStart(width, "0");
  }

  private async resolveVersionsDir(workspaceFolder: string): Promise<string> {
    const path = require("path");
    const vscodeApi = require("vscode");
    const cfg = ConfigurationManager.getConfiguration();
    // best-effort: read ini for version_locations
    try {
      const uri = vscodeApi.Uri.joinPath(
        vscodeApi.workspace.workspaceFolders[0].uri,
        cfg.configFile,
      );
      const raw = (await vscodeApi.workspace.fs.readFile(uri)).toString();
      const m =
        raw.match(/^[ \t]*version_locations\s*=\s*(.+)$/m) ||
        raw.match(/^[ \t]*script_location\s*=\s*(.+)$/m);
      const val = m ? m[1].trim().split(/[ ,]/)[0] : "alembic/versions";
      return path.isAbsolute(val) ? val : path.join(workspaceFolder, val);
    } catch {
      return path.join(workspaceFolder, "alembic", "versions");
    }
  }

  async upgrade(revision?: string): Promise<void> {
    const target = revision || "head";

    try {
      const command = this.buildCommand(["upgrade", target]);
      await this.executeCommand(command);
      vscode.window.showInformationMessage(`Database upgraded to ${target}`);
      vscode.commands.executeCommand("alembic.refreshMigrations");
    } catch (error) {
      this.showError("Failed to upgrade database", error);
    }
  }

  async downgrade(revision?: string): Promise<void> {
    let target = revision;

    if (!target) {
      target = await vscode.window.showInputBox({
        prompt: "Enter target revision (e.g., -1, base, revision_id)",
        placeHolder: "-1",
      });
    }

    if (!target) {
      return;
    }

    try {
      const command = this.buildCommand(["downgrade", target]);
      await this.executeCommand(command);
      vscode.window.showInformationMessage(`Database downgraded to ${target}`);
      vscode.commands.executeCommand("alembic.refreshMigrations");
    } catch (error) {
      this.showError("Failed to downgrade database", error);
    }
  }

  async showHistory(): Promise<void> {
    try {
      const command = this.buildCommand(["history", "--verbose"]);
      const result = await this.executeCommand(command);

      // Show history in output channel
      this.outputChannel.clear();
      this.outputChannel.appendLine("=== Alembic Migration History ===");
      this.outputChannel.appendLine(result);
      this.outputChannel.show();
    } catch (error) {
      this.showError("Failed to get migration history", error);
    }
  }

  async showVersion(): Promise<void> {
    try {
      const version = await this.getAlembicVersion();
      if (version) {
        vscode.window.showInformationMessage(`Alembic version: ${version}`);
        this.outputChannel.appendLine(`Alembic version: ${version}`);
      } else {
        vscode.window.showErrorMessage("Could not determine Alembic version");
      }
    } catch (error) {
      this.showError("Failed to get Alembic version", error);
    }
  }

  async getMigrations(): Promise<Migration[]> {
    try {
      const historyResult = await this.executeCommand(
        this.buildCommand(["history"]),
      );
      const currentResult = await this.executeCommand(
        this.buildCommand(["current"]),
      );

      const migrations = this.parseMigrations(historyResult, currentResult);

      // Determine applied vs pending by walking ancestors from current revision
      const current = migrations.find((m) => m.isCurrent)?.id;
      if (current) {
        const idToDown: Record<string, string | undefined> = {};
        for (const m of migrations) {
          idToDown[m.id] = m.downRevision;
        }
        const applied = new Set<string>();
        let walker: string | undefined = current;
        while (walker) {
          applied.add(walker);
          walker = idToDown[walker];
        }
        for (const m of migrations) {
          m.isApplied = applied.has(m.id);
        }
      } else {
        // No current -> nothing applied
        for (const m of migrations) {
          m.isApplied = false;
        }
      }

      return migrations;
    } catch (error) {
      console.error("Failed to get migrations:", error);
      return [];
    }
  }

  async getMigrationGraph(): Promise<{ nodes: any[]; edges: any[] }> {
    try {
      const migrations = await this.getMigrations();
      const nodes = migrations.map((migration) => ({
        id: migration.id,
        label: migration.shortId,
        title: migration.message,
        color: migration.isCurrent
          ? "#4CAF50"
          : migration.isApplied
            ? "#2196F3"
            : "#FFC107",
        font: { color: "white" },
      }));

      const edges = migrations
        .filter((m) => m.downRevision)
        .map((m) => ({
          from: m.downRevision,
          to: m.id,
          arrows: "to",
        }));

      return { nodes, edges };
    } catch (error) {
      console.error("Failed to get migration graph:", error);
      return { nodes: [], edges: [] };
    }
  }

  async mergeBranches(preselectedHead?: string): Promise<void> {
    try {
      // List heads (verbose for descriptions)
      const headsOut = await this.executeCommand(
        this.buildCommand(["heads", "-v"]),
      );
      const lines = headsOut
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const rawHeads: Array<{ id: string; label: string }> = [];
      for (const line of lines) {
        const m = line.match(/^([0-9a-f]+)\b.*?\s+(.*)$/i);
        if (m) {
          const id = m[1];
          const label = line.replace(m[1], "").trim();
          rawHeads.push({ id, label });
        }
      }
      const heads = Array.from(new Set(rawHeads.map((h) => h.id)));
      if (heads.length < 2) {
        vscode.window.showInformationMessage(
          "Nothing to merge: less than two heads",
        );
        return;
      }
      const items = rawHeads.map(
        (h) =>
          ({
            label: h.id,
            description: h.label,
            picked: preselectedHead === h.id,
          }) as vscode.QuickPickItem,
      );
      const selected = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: "Select heads to merge",
      });
      const picks = selected?.map((i) => i.label);
      if (!picks || picks.length < 2) {
        return;
      }
      const message = await vscode.window.showInputBox({
        prompt: "Merge message",
        value: "merge heads",
      });
      const args = ["merge", ...picks, "-m", message || "merge heads"];
      const command = this.buildCommand(args);
      await this.executeCommand(command);
      vscode.window.showInformationMessage("Branches merged");
      vscode.commands.executeCommand("alembic.refreshMigrations");
    } catch (error) {
      this.showError("Failed to merge branches", error);
    }
  }

  private parseMigrations(
    historyOutput: string,
    currentOutput: string,
  ): Migration[] {
    const migrations: Migration[] = [];
    const currentMigration = currentOutput.trim();
    const lines = historyOutput.split("\n");
    const config = ConfigurationManager.getConfiguration();

    for (const line of lines) {
      const match = line.match(
        /^([a-f0-9]+)\s+\->\s+([a-f0-9]+)?\s*,?\s*(.*)$/,
      );
      if (match) {
        const [, downRev, id, message] = match;
        if (id) {
          migrations.push({
            id: id,
            shortId: config.showFullHash ? id : AlembicUtils.getShortHash(id),
            message: AlembicUtils.formatMessage(message.trim()),
            isCurrent: id === currentMigration,
            isApplied: true, // We'll determine this more accurately later
            downRevision: downRev !== "None" ? downRev : undefined,
          });
        }
      }
    }

    return migrations;
  }

  private async getAvailableTemplates(): Promise<
    Array<{ label: string; description: string; detail?: string }>
  > {
    try {
      const command = this.buildCommand(["list_templates"]);
      this.outputChannel.appendLine(
        "Getting available templates from Alembic...",
      );
      const output = await this.executeCommand(command);

      const templates: Array<{
        label: string;
        description: string;
        detail?: string;
      }> = [];
      const lines = output.split("\n");
      let inTemplateSection = false;

      for (const line of lines) {
        // Look for the start of template list
        if (line.includes("Available templates:")) {
          inTemplateSection = true;
          continue;
        }

        // Stop when we reach the usage section
        if (
          inTemplateSection &&
          (line.includes("Templates are used via") ||
            line.includes("alembic init"))
        ) {
          break;
        }

        if (inTemplateSection && line.trim()) {
          // Handle different possible formats:
          // "generic - Generic single-database configuration."
          // "pyproject_async - pyproject configuration, with an async dbapi."
          const trimmedLine = line.trim();

          // Skip empty lines and lines that don't look like template definitions
          if (!trimmedLine || trimmedLine.startsWith("  alembic init")) {
            continue;
          }

          const match = trimmedLine.match(/^(\w+)\s*-\s*(.+)\.?$/);
          if (match) {
            const [, label, description] = match;
            const cleanDescription = description.trim().replace(/\.$/, "");

            // Use original description from Alembic, but add enhancements
            const template = {
              label: label.trim(),
              description:
                label.trim() === "generic"
                  ? `${cleanDescription} (Recommended)`
                  : cleanDescription,
              detail: this.getTemplateDetail(label.trim()),
            };

            templates.push(template);
          }
        }
      }

      // If we found templates, return them
      if (templates.length > 0) {
        this.outputChannel.appendLine(
          `Found ${templates.length} templates from Alembic:`,
        );
        templates.forEach((template) => {
          this.outputChannel.appendLine(
            `  - ${template.label}: ${template.description.replace(
              " (Recommended)",
              "",
            )}`,
          );
        });

        // Sort to put 'generic' first (recommended default)
        templates.sort((a, b) => {
          if (a.label === "generic") {
            return -1;
          }
          if (b.label === "generic") {
            return 1;
          }
          return a.label.localeCompare(b.label);
        });
        return templates;
      } else {
        this.outputChannel.appendLine(
          "No templates found in Alembic output, using fallback",
        );
      }
    } catch (error) {
      this.outputChannel.appendLine(
        `Warning: Could not get templates from Alembic: ${error}`,
      );
    }

    // Fallback to known templates if command fails
    this.outputChannel.appendLine("Using fallback template list");
    return this.getFallbackTemplates();
  }

  private getTemplateDetail(label: string): string | undefined {
    const templateDetails: { [key: string]: string } = {
      generic: "Standard template for most projects with a single database",
      async:
        "For projects using async/await database operations (asyncio, asyncpg, etc.)",
      multidb: "For applications that need to manage multiple databases",
      pyproject: "Uses pyproject.toml for configuration instead of alembic.ini",
      pyproject_async:
        "Combines pyproject.toml configuration with async database operations",
    };

    return templateDetails[label];
  }

  private getFallbackTemplates(): Array<{
    label: string;
    description: string;
    detail?: string;
  }> {
    // Use descriptions similar to what Alembic would provide
    const fallbackTemplates = [
      {
        label: "generic",
        description: "Generic single-database configuration",
        detail: this.getTemplateDetail("generic"),
      },
    ];

    // Mark generic as recommended and sort
    fallbackTemplates.forEach((template) => {
      if (template.label === "generic") {
        template.description = `${template.description} (Recommended)`;
      }
    });

    return fallbackTemplates;
  }

  private async askForTemplate(): Promise<string | undefined> {
    const templates = await this.getAvailableTemplates();

    const selected = await vscode.window.showQuickPick(templates, {
      placeHolder: "Select Alembic template",
      matchOnDescription: true,
    });

    return selected?.label;
  }

  private async askForDirectoryName(): Promise<string | undefined> {
    const directoryName = await vscode.window.showInputBox({
      prompt: "Enter directory name for Alembic configuration",
      placeHolder: "alembic",
      value: "alembic",
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return "Directory name cannot be empty";
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
          return "Directory name can only contain letters, numbers, underscores and hyphens";
        }
        return null;
      },
    });

    return directoryName?.trim();
  }

  private buildCommand(args: string[]): string[] {
    const config = ConfigurationManager.getConfiguration();
    const alembicPath = config.alembicPath;
    const configFile = config.configFile;

    const fullArgs = ["-c", configFile, ...args];
    return [alembicPath, ...fullArgs];
  }

  private async executeCommand(
    command: string[],
    cwd?: string,
  ): Promise<string> {
    const workspaceFolder = cwd || this.getWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error("No workspace folder available");
    }

    return new Promise((resolve, reject) => {
      const { spawn } = require("child_process");
      const [cmd, ...args] = command;

      this.outputChannel.appendLine(`Executing: ${command.join(" ")}`);

      const process = spawn(cmd, args, {
        cwd: workspaceFolder,
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data: Buffer) => {
        const output = data.toString();
        stdout += output;
        this.outputChannel.append(output);
      });

      process.stderr.on("data", (data: Buffer) => {
        const output = data.toString();
        stderr += output;
        this.outputChannel.append(output);
      });

      process.on("close", (code: number) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });
    });
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

  private showError(message: string, error: any): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`${message}: ${errorMessage}`);
    this.outputChannel.appendLine(`Error: ${message} - ${errorMessage}`);
  }
}
