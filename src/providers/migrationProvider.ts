import * as vscode from "vscode";
import { Migration } from "../models/migration";
import { AlembicService } from "../services/alembicService";

export class AlembicMigrationProvider
  implements vscode.TreeDataProvider<MigrationItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    MigrationItem | undefined | null | void
  > = new vscode.EventEmitter<MigrationItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    MigrationItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private alembicService: AlembicService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MigrationItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: MigrationItem): Promise<MigrationItem[]> {
    if (!element) {
      // Root level - return migration categories
      try {
        const migrations = await this.alembicService.getMigrations();
        if (migrations.length === 0) {
          return [
            new MigrationItem(
              "No migrations found",
              "",
              vscode.TreeItemCollapsibleState.None,
              "info",
            ),
          ];
        }

        const categories: MigrationItem[] = [];

        // Group migrations by status
        const applied = migrations.filter((m) => m.isApplied && !m.isCurrent);
        const current = migrations.filter((m) => m.isCurrent);
        const pending = migrations.filter((m) => !m.isApplied);

        if (current.length > 0) {
          categories.push(
            this.createCategoryItem(
              "Current",
              "current",
              current.map((m) => this.createMigrationItem(m, "current")),
              vscode.TreeItemCollapsibleState.Expanded,
            ),
          );
        }

        if (applied.length > 0) {
          categories.push(
            this.createCategoryItem(
              "Applied",
              "applied",
              applied.map((m) => this.createMigrationItem(m, "applied")),
              vscode.TreeItemCollapsibleState.Collapsed,
            ),
          );
        }

        if (pending.length > 0) {
          categories.push(
            this.createCategoryItem(
              "Pending",
              "pending",
              pending.map((m) => this.createMigrationItem(m, "pending")),
              vscode.TreeItemCollapsibleState.Collapsed,
            ),
          );
        }

        return categories;
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to load migrations: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        return [
          new MigrationItem(
            "Failed to load migrations",
            "",
            vscode.TreeItemCollapsibleState.None,
            "error",
          ),
        ];
      }
    }

    return element.children ?? [];
  }

  private createCategoryItem(
    label: string,
    id: string,
    children: MigrationItem[],
    collapsibleState: vscode.TreeItemCollapsibleState,
  ): MigrationItem {
    const item = new MigrationItem(
      `${label} (${children.length})`,
      `category:${id}`,
      collapsibleState,
      "category",
      children,
    );
    item.iconPath = new vscode.ThemeIcon("folder");
    return item;
  }

  private createMigrationItem(
    migration: Migration,
    status: string,
  ): MigrationItem {
    const label = `${migration.shortId} - ${migration.message}`;
    const item = new MigrationItem(
      label,
      migration.id,
      vscode.TreeItemCollapsibleState.None,
      "migration",
    );

    // Set icon based on status
    if (status === "current") {
      item.iconPath = new vscode.ThemeIcon(
        "arrow-right",
        new vscode.ThemeColor("charts.green"),
      );
    } else if (status === "applied") {
      item.iconPath = new vscode.ThemeIcon(
        "check",
        new vscode.ThemeColor("charts.blue"),
      );
    } else {
      item.iconPath = new vscode.ThemeIcon(
        "clock",
        new vscode.ThemeColor("charts.orange"),
      );
    }

    // Set tooltip
    item.tooltip = `${migration.id}\n${migration.message}\nStatus: ${status}`;

    // Add command to open migration file on click
    item.command = {
      command: "alembic.openMigrationFile",
      title: "Open Migration File",
      arguments: [migration.id]
    };

    return item;
  }
}

class MigrationItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly id: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly children?: MigrationItem[],
  ) {
    super(label, collapsibleState);
    this.id = id;
  }
}
