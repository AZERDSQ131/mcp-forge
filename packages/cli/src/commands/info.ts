import chalk from "chalk";
import { getServer } from "../registry.js";

export async function info(serverId: string): Promise<void> {
  const server = await getServer(serverId);

  if (!server) {
    console.log(chalk.red(`\nUnknown server: ${chalk.bold(serverId)}`));
    console.log(chalk.dim(`Run ${chalk.italic("mcpm search")} to browse available servers.\n`));
    return;
  }

  const pkg = server.args.find((a) => !a.startsWith("-") && a !== "-y") ?? "";
  const npmUrl = pkg ? `https://www.npmjs.com/package/${pkg}` : null;

  console.log();
  console.log(chalk.bold(server.name));
  console.log(chalk.dim("─".repeat(40)));
  console.log(server.description);
  console.log();

  console.log(chalk.bold("Command"));
  console.log(`  ${server.command} ${server.args.join(" ")}`);
  console.log();

  const envEntries = Object.entries(server.env);
  if (envEntries.length > 0) {
    console.log(chalk.bold("Environment variables"));
    for (const [key, meta] of envEntries) {
      const req = meta.required ? chalk.red("required") : chalk.dim("optional");
      console.log(`  ${chalk.cyan(key)} ${req}`);
      console.log(`    ${chalk.dim(meta.description)}`);
    }
    console.log();
  }

  console.log(chalk.bold("Tags"));
  console.log("  " + server.tags.map((t) => chalk.cyan(`#${t}`)).join("  "));
  console.log();

  if (npmUrl) {
    console.log(chalk.bold("Package"));
    console.log(`  ${chalk.underline(npmUrl)}`);
    console.log();
  }

  console.log(chalk.dim(`Install: `) + chalk.italic(`mcpm install ${serverId}`));
  console.log();
}
