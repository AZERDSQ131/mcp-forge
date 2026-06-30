import chalk from "chalk";
import { execSync } from "child_process";
import ora from "ora";
import { detectClients } from "../clients/detect.js";
import { listInstalledServers } from "../clients/config.js";
import { getServer } from "../registry.js";

interface ServerHealth {
  id: string;
  command: string;
  args: string[];
  status: "ok" | "broken" | "unknown";
  fix?: string;
}

function hasCommand(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function checkPyPI(pkg: string): boolean {
  try {
    const out = execSync(`curl -sf "https://pypi.org/pypi/${pkg}/json"`, { stdio: "pipe", timeout: 10_000 });
    const data = JSON.parse(out.toString()) as { info?: { version?: string } };
    return !!data.info?.version;
  } catch {
    return false;
  }
}

export async function doctor(): Promise<void> {
  const clients = detectClients();

  console.log(chalk.bold("\nmcpm doctor\n"));

  // Runtime checks
  const hasNpx = hasCommand("npx");
  const hasUvx = hasCommand("uvx");

  console.log(chalk.bold("Runtimes"));
  console.log(`  ${hasNpx ? chalk.green("✓") : chalk.red("✗")} npx ${hasNpx ? chalk.dim("(Node.js)") : chalk.red("— install Node.js")}`);
  console.log(`  ${hasUvx ? chalk.green("✓") : chalk.yellow("~")} uvx ${hasUvx ? chalk.dim("(Python)") : chalk.yellow("— install uv: curl -LsSf https://astral.sh/uv/install.sh | sh")}`);
  console.log();

  const allBroken: string[] = [];

  for (const client of clients) {
    const icon = client.detected ? chalk.green("●") : chalk.dim("○");
    console.log(`${icon} ${chalk.bold(client.name)}`);

    if (!client.detected) {
      console.log(chalk.dim("  not detected\n"));
      continue;
    }

    const servers = listInstalledServers(client);
    const entries = Object.entries(servers);

    if (entries.length === 0) {
      console.log(chalk.dim("  no servers installed\n"));
      continue;
    }

    const spinner = ora({ text: "Checking packages...", indent: 2 }).start();
    const results: ServerHealth[] = [];

    for (const [id, config] of entries) {
      const health = await checkServer(id, config.command, config.args, hasUvx);
      results.push(health);
    }

    spinner.stop();

    for (const result of results) {
      if (result.status === "ok") {
        console.log(`  ${chalk.green("✓")} ${chalk.bold(result.id)}`);
      } else if (result.status === "broken") {
        console.log(`  ${chalk.red("✗")} ${chalk.bold(result.id)} ${chalk.red("— package not found")}`);
        if (result.fix) console.log(`    ${chalk.dim("→")} ${chalk.cyan(result.fix)}`);
        allBroken.push(result.id);
      } else {
        console.log(`  ${chalk.yellow("~")} ${chalk.bold(result.id)} ${chalk.dim("— cannot verify")}`);
      }
    }

    console.log();
  }

  if (allBroken.length === 0) {
    console.log(chalk.green("✓ All servers healthy\n"));
  } else {
    console.log(chalk.red(`✗ ${allBroken.length} broken server${allBroken.length > 1 ? "s" : ""}: `) + allBroken.join(", "));
    console.log(chalk.dim("\nTo reinstall: ") + chalk.italic(`mcpm uninstall <name> && mcpm install <name>\n`));
  }
}

async function checkServer(id: string, command: string, args: string[], hasUvx: boolean): Promise<ServerHealth> {
  if (command === "npx") {
    const pkg = args.find((a) => !a.startsWith("-") && a !== "-y");
    if (!pkg) return { id, command, args, status: "unknown" };
    try {
      execSync(`npm view ${pkg} version`, { stdio: "pipe", timeout: 10_000 });
      return { id, command, args, status: "ok" };
    } catch {
      const known = await getServer(id);
      const registryPkg = known?.args.find((a) => !a.startsWith("-") && a !== "-y");
      const fix = registryPkg && registryPkg !== pkg
        ? `mcpm uninstall ${id} && mcpm install ${id}  (correct package: ${registryPkg})`
        : undefined;
      return { id, command, args, status: "broken", fix };
    }
  }

  if (command === "uvx") {
    const pkg = args.find((a) => !a.startsWith("-") && a !== "--from");
    if (!pkg) return { id, command, args, status: "unknown" };
    if (!hasUvx) {
      return { id, command, args, status: "unknown" };
    }
    const found = checkPyPI(pkg);
    if (found) return { id, command, args, status: "ok" };
    const known = await getServer(id);
    const registryPkg = known?.args.find((a) => !a.startsWith("-") && a !== "--from");
    const fix = registryPkg && registryPkg !== pkg
      ? `mcpm uninstall ${id} && mcpm install ${id}  (correct package: ${registryPkg})`
      : undefined;
    return { id, command, args, status: "broken", fix };
  }

  return { id, command, args, status: "unknown" };
}
