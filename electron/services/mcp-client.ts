import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Lightweight wrapper around an MCP stdio client connected to a filesystem
 * server scoped to a single root path. Created per agent run, disposed when
 * the agent loop returns — the npx-spawned subprocess is short enough that
 * keeping a singleton would just complicate config-change semantics.
 *
 * The filesystem server is the only kind we wire today; widening to
 * user-configured servers means accepting `{ command, args }` instead of
 * `rootPath` and keeping the rest of the surface unchanged.
 */
export class FilesystemMcpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  async connect(rootPath: string): Promise<void> {
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", rootPath],
      stderr: "pipe",
    });
    const client = new Client(
      { name: "scribe-notes-agent", version: "0.1.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    this.transport = transport;
    this.client = client;
  }

  async listTools(): Promise<McpTool[]> {
    if (!this.client) throw new Error("MCP client not connected");
    const res = await this.client.listTools();
    return (res.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
    }));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) throw new Error("MCP client not connected");
    const res = (await this.client.callTool({ name, arguments: args })) as {
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    // Serialize all text blocks back into a single string — the Anthropic
    // tool_result schema accepts either string or content blocks; string
    // keeps the prompt shorter and the protocol round-trip simpler.
    const parts: string[] = [];
    for (const block of res.content ?? []) {
      if (block.type === "text" && typeof block.text === "string") {
        parts.push(block.text);
      }
    }
    const text = parts.join("\n");
    if (res.isError) {
      // Surface errors back to the model as tool output rather than
      // throwing — the model recovers (e.g. tries a different path) instead
      // of crashing the whole generation.
      return `ERROR: ${text || "tool call failed"}`;
    }
    return text;
  }

  async dispose(): Promise<void> {
    try {
      await this.client?.close();
    } catch {
      /* ignore */
    }
    try {
      await this.transport?.close();
    } catch {
      /* ignore */
    }
    this.client = null;
    this.transport = null;
  }
}
