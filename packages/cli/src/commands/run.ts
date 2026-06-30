import chalk from "chalk";
import inquirer from "inquirer";
import { spawn } from "child_process";
import { getServer } from "../registry.js";

interface McpTool {
  name: string;
  description?: string;
}

export async function run(serverId: string): Promise<void> {
  const server = await getServer(serverId);

  if (!server) {
    console.log(chalk.red(`\nUnknown server: ${chalk.bold(serverId)}`));
    console.log(chalk.dim(`Run ${chalk.italic("mcpm search")} to browse available servers.\n`));
    return;
  }

  console.log(chalk.bold(`\nRunning ${server.name} temporarily...`));
  console.log(chalk.dim("Nothing will be saved to your config.\n"));

  // Prompt for required env vars
  const envValues: Record<string, string> = {};
  for (const [key, meta] of Object.entries(server.env)) {
    if (meta.required) {
      const { value } = await inquirer.prompt<{ value: string }>([
        {
          type: "password",
          name: "value",
          message: `${key} — ${chalk.dim(meta.description)}:`,
          mask: "*",
          validate: (i: string) => i.trim().length > 0 || `${key} is required`,
        },
      ]);
      envValues[key] = value.trim();
    }
  }

  const env = { ...process.env, ...envValues };
  const [cmd, ...args] = [server.command, ...server.args];

  console.log(chalk.dim(`\nStarting: ${cmd} ${args.join(" ")}\n`));

  const proc = spawn(cmd, args, { env, stdio: ["pipe", "pipe", "inherit"] });

  let buffer = "";
  let initialized = false;
  let toolsListed = false;

  proc.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as {
          id?: number;
          result?: {
            serverInfo?: { name: string; version: string };
            tools?: McpTool[];
          };
        };

        if (msg.id === 1 && msg.result?.serverInfo && !initialized) {
          initialized = true;
          const si = msg.result.serverInfo;
          console.log(chalk.green(`✓ Connected to ${si.name} v${si.version}`));

          // Send notifications/initialized then tools/list
          proc.stdin.write(
            JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n"
          );
          proc.stdin.write(
            JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n"
          );
        }

        if (msg.id === 2 && msg.result?.tools && !toolsListed) {
          toolsListed = true;
          const tools = msg.result.tools;
          console.log(chalk.bold(`\n${tools.length} tool${tools.length !== 1 ? "s" : ""} available:\n`));
          for (const tool of tools) {
            console.log(`  ${chalk.cyan(tool.name)}`);
            if (tool.description) console.log(`    ${chalk.dim(tool.description)}`);
          }
          console.log(chalk.dim("\nPress Ctrl+C to stop.\n"));
        }
      } catch {
        // Not JSON, ignore
      }
    }
  });

  // MCP handshake: initialize
  proc.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mcpm", version: "0.1.0" },
      },
    }) + "\n"
  );

  // Keep alive until Ctrl+C
  process.on("SIGINT", () => {
    console.log(chalk.dim("\nStopping server..."));
    proc.kill();
    process.exit(0);
  });

  proc.on("close", (code) => {
    if (code !== 0 && code !== null) {
      console.log(chalk.red(`\nServer exited with code ${code}\n`));
    }
    process.exit(0);
  });
}
