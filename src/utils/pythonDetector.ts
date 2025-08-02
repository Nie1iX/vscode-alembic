import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';

export interface PythonInterpreter {
	path: string;
	version?: string;
	displayName: string;
	source: 'workspace' | 'venv' | 'conda' | 'system' | 'python-extension';
}

export class PythonDetector {
	/**
	 * Detects available Python interpreters in the workspace and system
	 * @returns Array of found Python interpreters
	 */
	static async detectPythonInterpreters(): Promise<PythonInterpreter[]> {
		const interpreters: PythonInterpreter[] = [];

		// Try to get Python from VS Code Python extension
		const pythonExtensionInterpreter = await this.getPythonFromExtension();
		if (pythonExtensionInterpreter) {
			interpreters.push(pythonExtensionInterpreter);
		}

		// Check for virtual environments in workspace
		const workspaceInterpreters = await this.detectWorkspaceInterpreters();
		interpreters.push(...workspaceInterpreters);

		// Check for conda environments
		const condaInterpreters = await this.detectCondaInterpreters();
		interpreters.push(...condaInterpreters);

		// Check for system Python
		const systemInterpreters = await this.detectSystemInterpreters();
		interpreters.push(...systemInterpreters);

		// Remove duplicates based on path
		const uniqueInterpreters = interpreters.filter((interpreter, index, self) =>
			index === self.findIndex(i => i.path === interpreter.path)
		);

		// Sort by preference: Python extension > workspace > conda > system
		const sortOrder = { 'python-extension': 0, 'workspace': 1, 'venv': 2, 'conda': 3, 'system': 4 };
		uniqueInterpreters.sort((a, b) => sortOrder[a.source] - sortOrder[b.source]);

		return uniqueInterpreters;
	}

	/**
	 * Gets the currently selected Python interpreter from VS Code Python extension
	 */
	private static async getPythonFromExtension(): Promise<PythonInterpreter | null> {
		try {
			// Try to get Python path from Python extension
			const pythonExtension = vscode.extensions.getExtension('ms-python.python');
			if (pythonExtension && pythonExtension.isActive) {
				const pythonApi = pythonExtension.exports;
				if (pythonApi && pythonApi.settings && pythonApi.settings.getExecutionDetails) {
					const execDetails = pythonApi.settings.getExecutionDetails(vscode.workspace.workspaceFolders?.[0]?.uri);
					if (execDetails && execDetails.execCommand && execDetails.execCommand.length > 0) {
						const pythonPath = execDetails.execCommand[0];
						const version = await this.getPythonVersion(pythonPath);
						return {
							path: pythonPath,
							version,
							displayName: `Python ${version || 'Unknown'} (VS Code Python Extension)`,
							source: 'python-extension'
						};
					}
				}
			}
		} catch (error) {
			// Python extension not available or not active
		}
		return null;
	}

	/**
	 * Detects Python interpreters in the current workspace
	 */
	private static async detectWorkspaceInterpreters(): Promise<PythonInterpreter[]> {
		const interpreters: PythonInterpreter[] = [];
		const workspaceFolders = vscode.workspace.workspaceFolders;

		if (!workspaceFolders) {
			return interpreters;
		}

		for (const folder of workspaceFolders) {
			const workspacePath = folder.uri.fsPath;

			// Check for common virtual environment locations
			const venvPaths = [
				path.join(workspacePath, 'venv', 'bin', 'python'),
				path.join(workspacePath, 'venv', 'Scripts', 'python.exe'),
				path.join(workspacePath, '.venv', 'bin', 'python'),
				path.join(workspacePath, '.venv', 'Scripts', 'python.exe'),
				path.join(workspacePath, 'env', 'bin', 'python'),
				path.join(workspacePath, 'env', 'Scripts', 'python.exe'),
			];

			for (const pythonPath of venvPaths) {
				if (await this.fileExists(pythonPath)) {
					const version = await this.getPythonVersion(pythonPath);
					interpreters.push({
						path: pythonPath,
						version,
						displayName: `Python ${version || 'Unknown'} (${path.basename(path.dirname(path.dirname(pythonPath)))})`,
						source: 'workspace'
					});
				}
			}
		}

		return interpreters;
	}

	/**
	 * Detects Conda environments
	 */
	private static async detectCondaInterpreters(): Promise<PythonInterpreter[]> {
		const interpreters: PythonInterpreter[] = [];

		try {
			// Try to find conda environments
			const condaOutput = await this.executeCommand('conda', ['env', 'list']);
			const lines = condaOutput.split('\n');

			for (const line of lines) {
				const match = line.match(/^(\S+)\s+\*?\s+(.+)$/);
				if (match && !line.startsWith('#')) {
					const [, envName, envPath] = match;
					const pythonPath = process.platform === 'win32'
						? path.join(envPath.trim(), 'python.exe')
						: path.join(envPath.trim(), 'bin', 'python');

					if (await this.fileExists(pythonPath)) {
						const version = await this.getPythonVersion(pythonPath);
						interpreters.push({
							path: pythonPath,
							version,
							displayName: `Python ${version || 'Unknown'} (Conda: ${envName})`,
							source: 'conda'
						});
					}
				}
			}
		} catch (error) {
			// Conda not available
		}

		return interpreters;
	}

	/**
	 * Detects system Python interpreters
	 */
	private static async detectSystemInterpreters(): Promise<PythonInterpreter[]> {
		const interpreters: PythonInterpreter[] = [];
		const pythonCommands = ['python3', 'python', 'py'];

		for (const command of pythonCommands) {
			try {
				const pythonPath = await this.which(command);
				if (pythonPath && await this.fileExists(pythonPath)) {
					const version = await this.getPythonVersion(pythonPath);
					interpreters.push({
						path: pythonPath,
						version,
						displayName: `Python ${version || 'Unknown'} (System: ${command})`,
						source: 'system'
					});
				}
			} catch (error) {
				// Command not found
			}
		}

		return interpreters;
	}

	/**
	 * Shows a quick pick dialog for selecting Python interpreter
	 */
	static async showPythonInterpreterPicker(): Promise<PythonInterpreter | undefined> {
		const interpreters = await this.detectPythonInterpreters();

		if (interpreters.length === 0) {
			vscode.window.showErrorMessage('No Python interpreters found. Please install Python or check your PATH.');
			return undefined;
		}

		const items = interpreters.map(interpreter => ({
			label: interpreter.displayName,
			description: interpreter.path,
			detail: `Source: ${interpreter.source}`,
			interpreter
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select Python interpreter for Alembic',
			matchOnDescription: true,
			matchOnDetail: true
		});

		return selected?.interpreter;
	}

	/**
	 * Automatically detects and sets the best Python interpreter
	 */
	static async autoDetectAndSetPython(): Promise<string | undefined> {
		const interpreters = await this.detectPythonInterpreters();

		if (interpreters.length === 0) {
			return undefined;
		}

		// Use the first interpreter (highest priority)
		const bestInterpreter = interpreters[0];

		// Update configuration
		const config = vscode.workspace.getConfiguration('alembic');
		await config.update('pythonPath', bestInterpreter.path, vscode.ConfigurationTarget.Workspace);

		return bestInterpreter.path;
	}

	/**
	 * Gets Python version from executable
	 */
	private static async getPythonVersion(pythonPath: string): Promise<string | undefined> {
		try {
			const output = await this.executeCommand(pythonPath, ['--version']);
			const match = output.match(/Python\s+(\d+\.\d+\.\d+)/);
			return match ? match[1] : undefined;
		} catch (error) {
			return undefined;
		}
	}

	/**
	 * Checks if file exists
	 */
	private static async fileExists(filePath: string): Promise<boolean> {
		try {
			await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Executes a command and returns output
	 */
	private static async executeCommand(command: string, args: string[]): Promise<string> {
		return new Promise((resolve, reject) => {
			const process = spawn(command, args, { shell: true });
			let output = '';
			let error = '';

			process.stdout.on('data', (data) => {
				output += data.toString();
			});

			process.stderr.on('data', (data) => {
				error += data.toString();
			});

			process.on('close', (code) => {
				if (code === 0) {
					resolve(output.trim());
				} else {
					reject(new Error(error || `Process exited with code ${code}`));
				}
			});

			process.on('error', (err) => {
				reject(err);
			});
		});
	}

	/**
	 * Finds executable path using which/where command
	 */
	private static async which(command: string): Promise<string | undefined> {
		try {
			const whichCommand = process.platform === 'win32' ? 'where' : 'which';
			const output = await this.executeCommand(whichCommand, [command]);
			return output.split('\n')[0].trim();
		} catch (error) {
			return undefined;
		}
	}
}
