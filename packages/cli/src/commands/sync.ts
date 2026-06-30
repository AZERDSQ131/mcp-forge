import fs from "fs";
import path from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import { install } from "./install.js";
import { getBundle } from "../registry.js";

interface McpmRC {
  servers?: string[];
  bundles?: string[];
}

const RC_FILE = ".mcpmrc";

export function readRC(dir = process.cwd()): McpmRC | null {
  const rcPath = path.join(dir, RC_FILE);
  if (!fs.existsSync(rcPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(rcPath, "utf-8")) as McpmRC;
  } catch {
    return null;
  }
}

export function writeRC(data: McpmRC, dir = process.cwd()): void {
  const rcPath = path.join(dir, RC_FILE);
  fs.writeFileSync(rcPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export function addToRC(serverId: string, dir = process.cwd()): void {
  const existing = readRC(dir) ?? {};
  const servers = existing.servers ?? [];
  if (!servers.includes(serverId)) {
    existing.servers = [...servers, serverId];
    writeRC(existing, dir);
  }
}

export async function sync(): Promise<void> {
  const rc = readRC();

  if (!rc) {
    console.log(chalk.yellow(`\nNo ${RC_FILE} found in current directory.`));
    const { create } = await inquirer.prompt<{ create: boolean }>([
      {
        type: "confirm",
        name: "create",
        message: "Create one?",
        default: true,
      },
    ]);
    if (create) {
      writeRC({ servers: [] });
      console.log(chalk.green(`\n✓ Created ${RC_FILE} — add servers and run mcpm sync again.\n`));
    }
    return;
  }

  const servers = [...(rc.servers ?? [])];

  // Expand bundles
  for (const bundleRef of rc.bundles ?? []) {
    const bundleName = bundleRef.replace("@bundle/", "");
    const bundle = await getBundle(bundleName);
    if (bundle) servers.push(...bundle.servers);
    else console.log(chalk.yellow(`~ Unknown bundle: ${bundleRef}`));
  }

  const unique = [...new Set(servers)];

  if (unique.length === 0) {
    console.log(chalk.dim(`\n${RC_FILE} has no servers. Add some with mcpm install --save <server>\n`));
    return;
  }

  console.log(chalk.dim(`\nSyncing ${unique.length} servers from ${RC_FILE}...\n`));
  await install(unique);
}
