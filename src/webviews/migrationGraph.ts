import * as vscode from "vscode";
import { AlembicService } from "../services/alembicService";

export class MigrationGraphWebview {
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
      "migrationGraph",
      "Migration Graph",
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
          await this.updateGraph();
          break;
        case "refresh":
          await this.updateGraph();
          break;
        case "upgrade":
          await this.alembicService.upgrade(message.id);
          await this.updateGraph();
          break;
        case "downgrade":
          await this.alembicService.downgrade(message.id);
          await this.updateGraph();
          break;
        case "merge":
          await this.alembicService.mergeBranches(message.id);
          await this.updateGraph();
          break;
      }
    });

    // Clean up when panel is closed
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private async updateGraph(): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      const graphData = await this.alembicService.getMigrationGraph();
      this.panel.webview.postMessage({
        command: "updateGraph",
        data: graphData,
      });
    } catch (error) {
      console.error("Failed to update graph:", error);
      vscode.window.showErrorMessage("Failed to load migration graph");
    }
  }

  private async getWebviewContent(): Promise<string> {
    const webview = this.panel!.webview;
    const nonce = String(Date.now());
    const localVis = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "vis-network.min.js",
      ),
    );
    // Inline HTML with strict CSP and local vis-network (fallback CDN kept commented if needed)
    return `
 		<!DOCTYPE html>
 		<html lang="en">
 		<head>
 			<meta charset="UTF-8">
 			<meta name="viewport" content="width=device-width, initial-scale=1.0">
 			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource};">
 			<title>Migration Graph</title>
 			<script nonce="${nonce}" src="${localVis}"></script>
 			<!-- <script nonce="${nonce}" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script> -->
 			<style>
				body {
					font-family: var(--vscode-font-family);
					color: var(--vscode-foreground);
					background-color: var(--vscode-editor-background);
					margin: 0;
					padding: 0;
					display: flex;
					flex-direction: column;
					height: 100vh;
				}

				.toolbar {
					padding: 10px;
					background-color: var(--vscode-panel-background);
					border-bottom: 1px solid var(--vscode-panel-border);
					display: flex;
					gap: 10px;
					align-items: center;
				}

				.toolbar button {
					background-color: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					border: none;
					padding: 6px 12px;
					border-radius: 3px;
					cursor: pointer;
					font-size: 13px;
				}

				.toolbar button:hover {
					background-color: var(--vscode-button-hoverBackground);
				}

				#graph {
					flex: 1;
					width: 100%;
					height: 100%;
				}

				.legend {
					position: absolute;
					top: 50px;
					right: 10px;
					background-color: var(--vscode-panel-background);
					border: 1px solid var(--vscode-panel-border);
					padding: 10px;
					border-radius: 3px;
					font-size: 12px;
				}

				.legend-item {
					display: flex;
					align-items: center;
					margin-bottom: 5px;
				}

				.legend-color {
					width: 16px;
					height: 16px;
					border-radius: 50%;
					margin-right: 8px;
				}

				.no-data {
					display: flex;
					justify-content: center;
					align-items: center;
					height: 100%;
					color: var(--vscode-descriptionForeground);
					font-style: italic;
				}
			</style>
		</head>
		<body>
            <div class="toolbar">
                <button onclick="refreshGraph()">Refresh</button>
                <button onclick="fitNetwork()">Fit to Screen</button>
                <button onclick="togglePhysics()">Toggle Physics</button>
                <button onclick="upgradeSelected()">Upgrade to selected</button>
                <button onclick="downgradeSelected()">Downgrade to selected</button>
                <button onclick="mergeSelected()">Merge from selected</button>
                <span id="status">Loading...</span>
            </div>

			<div id="graph"></div>

			<div class="legend">
				<div class="legend-item">
					<div class="legend-color" style="background-color: #4CAF50;"></div>
					<span>Current</span>
				</div>
				<div class="legend-item">
					<div class="legend-color" style="background-color: #2196F3;"></div>
					<span>Applied</span>
				</div>
				<div class="legend-item">
					<div class="legend-color" style="background-color: #FFC107;"></div>
					<span>Pending</span>
				</div>
			</div>

			<script>
				const vscode = acquireVsCodeApi();
				let network = null;
				let physicsEnabled = true;

				// Network options
				const options = {
					layout: {
						hierarchical: {
							direction: 'DU',
							sortMethod: 'directed',
							nodeSpacing: 100,
							levelSeparation: 150
						}
					},
					physics: {
						enabled: true,
						hierarchicalRepulsion: {
							nodeDistance: 120,
							centralGravity: 0.0,
							springLength: 100,
							springConstant: 0.01,
							damping: 0.09
						}
					},
					nodes: {
						shape: 'box',
						margin: 10,
						font: {
							color: 'white',
							size: 14
						},
						borderWidth: 2,
						shadow: true
					},
					edges: {
						color: 'var(--vscode-foreground)',
						width: 2,
						arrows: {
							to: {
								enabled: true,
								scaleFactor: 1
							}
						},
						smooth: {
							type: 'dynamic'
						}
					},
					interaction: {
						dragNodes: true,
						dragView: true,
						zoomView: true
					}
				};

				function initNetwork() {
					const container = document.getElementById('graph');
					const data = { nodes: [], edges: [] };
					network = new vis.Network(container, data, options);

                // Handle node selection & actions
                network.on('selectNode', function(params) {
                    const nodeId = params.nodes[0];
                    window.currentNode = nodeId;
                });
				}

				function updateGraph(graphData) {
					if (!network) {
						initNetwork();
					}

					if (!graphData || (!graphData.nodes.length && !graphData.edges.length)) {
						document.getElementById('graph').innerHTML = '<div class="no-data">No migration data available</div>';
						document.getElementById('status').textContent = 'No data';
						return;
					}

					const nodes = new vis.DataSet(graphData.nodes);
					const edges = new vis.DataSet(graphData.edges);

					network.setData({ nodes, edges });

					// Fit network to view
					setTimeout(() => {
						network.fit();
					}, 100);

					document.getElementById('status').textContent = \`\${graphData.nodes.length} migrations\`;
				}

                function refreshGraph() {
					document.getElementById('status').textContent = 'Refreshing...';
					vscode.postMessage({ command: 'refresh' });
				}
                function upgradeSelected() {
                  if (window.currentNode) {
                    vscode.postMessage({ command: 'upgrade', id: window.currentNode });
                  }
                }
                function downgradeSelected() {
                  if (window.currentNode) {
                    vscode.postMessage({ command: 'downgrade', id: window.currentNode });
                  }
                }
                function mergeSelected() {
                  if (window.currentNode) {
                    vscode.postMessage({ command: 'merge', id: window.currentNode });
                  }
                }

				function fitNetwork() {
					if (network) {
						network.fit();
					}
				}

				function togglePhysics() {
					if (network) {
						physicsEnabled = !physicsEnabled;
						network.setOptions({ physics: { enabled: physicsEnabled } });
					}
				}

				// Handle messages from extension
				window.addEventListener('message', event => {
					const message = event.data;
					switch (message.command) {
						case 'updateGraph':
							updateGraph(message.data);
							break;
					}
				});

				// Initialize
				initNetwork();
				vscode.postMessage({ command: 'ready' });
			</script>
		</body>
		</html>
		`;
  }

  private async getWebviewContentFromTemplate(): Promise<string> {
    const webview = this.panel!.webview;
    const nonce = String(Date.now());
    const templateUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      "migrationGraph.html",
    );
    const visUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "vis-network.min.js",
      ),
    );
    const raw = await vscode.workspace.fs.readFile(templateUri);
    let html = Buffer.from(raw).toString("utf8");
    html = html
      .replace(/__NONCE__/g, nonce)
      .replace(/__VIS_JS__/g, String(visUri))
      .replace(/__CSP_SOURCE__/g, webview.cspSource);
    return html;
  }
}
