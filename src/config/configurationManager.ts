import * as vscode from 'vscode';
import { PythonDetector } from '../utils/pythonDetector';

export interface AlembicConfiguration {
	pythonPath: string;
	alembicPath: string;
	configFile: string;
	autoRefresh: boolean;
	showFullHash: boolean;
}

export class ConfigurationManager {
	private static readonly SECTION = 'alembic';

	/**
	 * Gets the current Alembic configuration
	 * @returns Current configuration object
	 */
	static getConfiguration(): AlembicConfiguration {
		const config = vscode.workspace.getConfiguration(this.SECTION);

		return {
			pythonPath: config.get<string>('pythonPath', 'python'),
			alembicPath: config.get<string>('alembicPath', 'alembic'),
			configFile: config.get<string>('configFile', 'alembic.ini'),
			autoRefresh: config.get<boolean>('autoRefresh', true),
			showFullHash: config.get<boolean>('showFullHash', false)
		};
	}

	/**
	 * Updates a specific configuration value
	 * @param key Configuration key
	 * @param value New value
	 * @param target Configuration target (global, workspace, or workspaceFolder)
	 */
	static async updateConfiguration(
		key: keyof AlembicConfiguration,
		value: any,
		target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
	): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.SECTION);
		await config.update(key, value, target);
	}

	/**
	 * Registers configuration change handlers
	 * @param handler Function to call when configuration changes
	 * @returns Disposable for the event listener
	 */
	static onConfigurationChanged(handler: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
		return vscode.workspace.onDidChangeConfiguration(handler);
	}

	/**
	 * Checks if a configuration change affects Alembic settings
	 * @param e Configuration change event
	 * @returns True if Alembic configuration was changed
	 */
	static affectsAlembicConfiguration(e: vscode.ConfigurationChangeEvent): boolean {
		return e.affectsConfiguration(this.SECTION);
	}

	/**
	 * Opens the VS Code settings page for Alembic configuration
	 */
	static async openSettings(): Promise<void> {
		await vscode.commands.executeCommand('workbench.action.openSettings', this.SECTION);
	}

	/**
	 * Validates the current configuration and shows warnings if needed
	 * @returns True if configuration is valid
	 */
	static async validateConfiguration(): Promise<boolean> {
		const config = this.getConfiguration();
		const issues: string[] = [];

		// Check if Alembic path is accessible
		if (!config.alembicPath) {
			issues.push('Alembic path is not configured');
		}

		// Check if Python path is accessible
		if (!config.pythonPath || config.pythonPath === 'python') {
			// Try to auto-detect Python interpreter
			const detectedPython = await PythonDetector.autoDetectAndSetPython();
			if (!detectedPython) {
				issues.push('Python interpreter is not configured and could not be auto-detected');
			}
		}

		// Check if config file exists in workspace
		if (config.configFile) {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (workspaceFolders && workspaceFolders.length > 0) {
				const configPath = vscode.Uri.joinPath(workspaceFolders[0].uri, config.configFile);
				try {
					await vscode.workspace.fs.stat(configPath);
				} catch (error) {
					issues.push(`Alembic config file not found: ${config.configFile}`);
				}
			}
		}

		if (issues.length > 0) {
			const message = `Alembic configuration issues found:\n${issues.join('\n')}`;
			const action = await vscode.window.showWarningMessage(
				message,
				'Configure Python',
				'Open Settings',
				'Ignore'
			);

			if (action === 'Configure Python') {
				await this.selectPythonInterpreter();
			} else if (action === 'Open Settings') {
				await this.openSettings();
			}

			return false;
		}

		return true;
	}

	/**
	 * Shows a quick pick for common Alembic configuration options
	 */
	static async showConfigurationQuickPick(): Promise<void> {
		const config = this.getConfiguration();

		const items: vscode.QuickPickItem[] = [
			{
				label: '$(gear) Open Settings',
				description: 'Open VS Code settings for Alembic',
				detail: 'Configure all Alembic extension settings'
			},
			{
				label: '$(file-binary) Python Path',
				description: config.pythonPath,
				detail: 'Path to Python executable'
			},
			{
				label: '$(database) Alembic Path',
				description: config.alembicPath,
				detail: 'Path to Alembic executable'
			},
			{
				label: '$(file-code) Config File',
				description: config.configFile,
				detail: 'Path to alembic.ini file'
			},
			{
				label: '$(sync) Auto Refresh',
				description: config.autoRefresh ? 'Enabled' : 'Disabled',
				detail: 'Automatically refresh when files change'
			},
			{
				label: '$(eye) Show Full Hash',
				description: config.showFullHash ? 'Enabled' : 'Disabled',
				detail: 'Show full migration hash instead of abbreviated'
			}
		];

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select configuration option to modify'
		});

		if (!selected) {
			return;
		}

		switch (selected.label) {
			case '$(gear) Open Settings':
				await this.openSettings();
				break;
			case '$(file-binary) Python Path':
				await this.selectPythonInterpreter();
				break;
			case '$(database) Alembic Path':
				await this.configureAlembicPath();
				break;
			case '$(file-code) Config File':
				await this.configureConfigFile();
				break;
			case '$(sync) Auto Refresh':
				await this.updateConfiguration('autoRefresh', !config.autoRefresh);
				break;
			case '$(eye) Show Full Hash':
				await this.updateConfiguration('showFullHash', !config.showFullHash);
				break;
		}
	}

	/**
	 * Shows Python interpreter picker and updates configuration
	 */
	static async selectPythonInterpreter(): Promise<void> {
		const interpreter = await PythonDetector.showPythonInterpreterPicker();
		if (interpreter) {
			await this.updateConfiguration('pythonPath', interpreter.path);
			vscode.window.showInformationMessage(`Python interpreter set to: ${interpreter.displayName}`);
		}
	}

	private static async configurePythonPath(): Promise<void> {
		// First try to show the Python interpreter picker
		const interpreter = await PythonDetector.showPythonInterpreterPicker();

		if (interpreter) {
			await this.updateConfiguration('pythonPath', interpreter.path);
			vscode.window.showInformationMessage(`Python interpreter set to: ${interpreter.displayName}`);
		} else {
			// Fallback to manual input
			const config = this.getConfiguration();
			const newPath = await vscode.window.showInputBox({
				prompt: 'Enter path to Python executable',
				value: config.pythonPath,
				placeHolder: 'python or /path/to/python'
			});

			if (newPath !== undefined) {
				await this.updateConfiguration('pythonPath', newPath);
			}
		}
	}

	private static async configureAlembicPath(): Promise<void> {
		const config = this.getConfiguration();
		const newPath = await vscode.window.showInputBox({
			prompt: 'Enter path to Alembic executable',
			value: config.alembicPath,
			placeHolder: 'alembic or /path/to/alembic'
		});

		if (newPath !== undefined) {
			await this.updateConfiguration('alembicPath', newPath);
		}
	}

	private static async configureConfigFile(): Promise<void> {
		const config = this.getConfiguration();
		const newPath = await vscode.window.showInputBox({
			prompt: 'Enter path to alembic.ini configuration file',
			value: config.configFile,
			placeHolder: 'alembic.ini or path/to/alembic.ini'
		});

		if (newPath !== undefined) {
			await this.updateConfiguration('configFile', newPath);
		}
	}
}
