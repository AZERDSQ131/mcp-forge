#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { install } from "./commands/install.js";
import { uninstall } from "./commands/uninstall.js";
import { search } from "./commands/search.js";
import { list } from "./commands/list.js";
import { update } from "./commands/update.js";
import { doctor } from "./commands/doctor.js";
import { info } from "./commands/info.js";
import { exportConfig, importConfig } from "./commands/exportImport.js";

const program = new Command();

const BANNER = `
  ${chalk.bold("mcpm")} ${chalk.dim("— universal MCP server manager")}
`;

program
  .name("mcpm")
  .description("Install and manage MCP servers across all your AI clients")
  .version("0.1.0")
  .addHelpText("before", BANNER);

program
  .command("install <servers...>")
  .alias("i")
  .description("Install one or more servers or a bundle (@bundle/<name>)")
  .action(async (servers: string[]) => {
    await install(servers);
  });

program
  .command("uninstall <server>")
  .alias("remove")
  .alias("rm")
  .description("Uninstall an MCP server")
  .action(async (server: string) => {
    await uninstall(server);
  });

program
  .command("search [query]")
  .alias("s")
  .description("Search the MCP server registry")
  .option("--bundles", "Show available bundles")
  .action((query?: string, opts?: { bundles?: boolean }) => {
    search(query, opts?.bundles);
  });

program
  .command("info <server>")
  .description("Show detailed info about an MCP server")
  .action(async (server: string) => {
    await info(server);
  });

program
  .command("list")
  .alias("ls")
  .description("List installed MCP servers across all clients")
  .action(async () => {
    await list();
  });

program
  .command("update")
  .description("Update all installed MCP servers to latest versions")
  .action(async () => {
    await update();
  });

program
  .command("doctor")
  .description("Check health of all installed MCP servers")
  .action(async () => {
    await doctor();
  });

program
  .command("export [file]")
  .description("Export installed servers to a JSON file (or stdout)")
  .action((file?: string) => {
    exportConfig(file);
  });

program
  .command("import <file>")
  .description("Import and install servers from an export file")
  .action(async (file: string) => {
    await importConfig(file);
  });

program.addHelpText(
  "after",
  `
${chalk.dim("Examples:")}
  ${chalk.italic("mcpm install github")}                   install GitHub MCP server
  ${chalk.italic("mcpm install @bundle/webdev")}           install the Web Dev bundle
  ${chalk.italic("mcpm search --bundles")}                 browse available bundles
  ${chalk.italic("mcpm info postgres")}                    show details about a server
  ${chalk.italic("mcpm list")}                             show all installed servers
  ${chalk.italic("mcpm doctor")}                           check server health
  ${chalk.italic("mcpm export ~/my-mcp-setup.json")}       backup your setup
  ${chalk.italic("mcpm import ~/my-mcp-setup.json")}       restore on a new machine
  ${chalk.italic("mcpm update")}                           update all servers
`
);

program.parse(process.argv);
