import * as vscode from 'vscode';
import * as path from 'path';
import { Migration } from '../models/migration';
import { AlembicService } from '../services/alembicService';

export class AlembicMigrationProvider implements vscode.TreeDataProvider<MigrationItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<MigrationItem | undefined | null | void> = new vscode.EventEmitter<MigrationItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<MigrationItem | undefined | null | void> = this._onDidChangeTreeData.event;

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
			const migrations = await this.alembicService.getMigrations();
			if (migrations.length === 0) {
				return [new MigrationItem('No migrations found', '', vscode.TreeItemCollapsibleState.None, 'info')];
			}

			const items: MigrationItem[] = [];
			
			// Group migrations by status
			const applied = migrations.filter(m => m.isApplied && !m.isCurrent);
			const current = migrations.filter(m => m.isCurrent);
			const pending = migrations.filter(m => !m.isApplied);

			if (current.length > 0) {
				items.push(new MigrationItem('Current', '', vscode.TreeItemCollapsibleState.Expanded, 'category'));
				items.push(...current.map(m => this.createMigrationItem(m, 'current')));
			}

			if (applied.length > 0) {
				items.push(new MigrationItem('Applied', '', vscode.TreeItemCollapsibleState.Collapsed, 'category'));
				items.push(...applied.map(m => this.createMigrationItem(m, 'applied')));
			}

			if (pending.length > 0) {
				items.push(new MigrationItem('Pending', '', vscode.TreeItemCollapsibleState.Collapsed, 'category'));
				items.push(...pending.map(m => this.createMigrationItem(m, 'pending')));
			}

			return items;
		}

		return [];
	}

	private createMigrationItem(migration: Migration, status: string): MigrationItem {
		const label = `${migration.shortId} - ${migration.message}`;
		const item = new MigrationItem(label, migration.id, vscode.TreeItemCollapsibleState.None, 'migration');
		
		// Set icon based on status
		if (status === 'current') {
			item.iconPath = new vscode.ThemeIcon('arrow-right', new vscode.ThemeColor('charts.green'));
		} else if (status === 'applied') {
			item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.blue'));
		} else {
			item.iconPath = new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.orange'));
		}

		// Set tooltip
		item.tooltip = `${migration.id}\n${migration.message}\nStatus: ${status}`;

		return item;
	}
}

class MigrationItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly id: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly contextValue: string
	) {
		super(label, collapsibleState);
		this.id = id;
	}
}
