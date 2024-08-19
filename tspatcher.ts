#!/usr/bin/env bun

import { $ } from "bun";
import { parseArguments } from "@typek/clap";
import { Option, fields } from "@typek/typek";

//
// CLI

if (import.meta.main) {
  const [_a, _b, ...args] = Bun.argv;
  const command = import.meta.file;

  out: switch (args[0]) {
    case "fetch": {
      const options = parseArguments(args.slice(1));
      const opts: GetOpt = options.has(`--branch`)
        ? { branch: options.get(`--branch`)! }
        : options.has(`--stable`)
          ? { latest: "stable" }
          : options.has(`--prerelease`)
            ? { latest: "prerelease" }
            : options.has(`--dev`)
              ? { latest: "dev" }
              : { latest: "stable" };

      await get(opts);
      break;
    }

    case "patch": {
      const options = parseArguments(args.slice(1));
      if (
        options.has(`--package-name`) ||
        options.has(`--package-make-public`)
      ) {
        const name = options.get(`--package-name`);
        if (name) console.log(`Changing package name to: ${name}`);

        const publicAccess = options.has(`--package-make-public`);
        if (publicAccess) console.log(`Making package public.`);

        await patchPackageJson({ name, publicAccess });
      }
      if (options.has(`--type-depth`)) {
        const depth = Option.map(options.get(`--type-depth`), parseInt) ?? 1000;
        console.log(`Changing maximum instantiation depth to: ${depth}`);
        await patchTypeDepth(depth);
      }
      break;
    }

    case "build": {
      const options = parseArguments(args.splice(1));
      await build({ dev: options.has(`--dev`) });
      break;
    }

    case "publish": {
      const options = parseArguments(args.slice(1));
      await publish({ otp: options.get(`--otp`) });
      break;
    }

    case "clean":
      await clean();
      break;

    // @ts-expect-error(7029) Fallthrough
    case "help":
      switch (args[1]) {
        case "fetch":
          console.log("Subcommand usage:");
          console.log(
            `  ${command} fetch [--stable | --prerelease | --dev | --branch=<branch>] – clone remote TS repository`
          );
          console.log();
          console.log("Options:");
          console.log(`  --stable – clone the latest stable release (default)`);
          console.log(
            `  --prerelease – clone the latest release (regardless whether it is stable)`
          );
          console.log(`  --dev – clone the latest commit in the main branch`);
          console.log(
            `  --branch=<branch> – clone a specific branch or tag of the repository`
          );
          console.log();
          break out;
        case "patch":
          console.log("Subcommand usage:");
          console.log(
            `  ${command} patch [--type-depth | --type-depth=<depth>] [--package-name=<name>] [--package-make-public]`
          );
          console.log();
          console.log("Options:");
          console.log(
            `  --type-depth – patches the maximum type instantiation depth, the default is 1000`
          );
          console.log(
            `  --package-name – set the name in package.json; necessary before publishing`
          );
          console.log(
            `  --package-make-public – make the package public to avoid NPM error 402`
          );
          console.log();
          break out;
        case "build":
          console.log("Subcommand usage:");
          console.log(
            `  ${command} build [--dev] – build the patched TypeScript`
          );
          console.log();
          console.log("Options:");
          console.log(
            "  --dev – configure project; necessary for a non-release version"
          );
          console.log();
          break out;
        case "publish":
          console.log("Subcommand usage:");
          console.log(
            `  ${command} publish [--otp=<otp>] – publish the patched TS package to NPM`
          );
          console.log();
          console.log("Options:");
          console.log(
            `  --otp=<otp> – the one time password for NPM, required for two-factor auth`
          );
          console.log();
          break out;
        case "clean":
          console.log("Subcommand usage:");
          console.log(`  ${command} clean – delete the TypeScript folder`);
          console.log();
          break out;
      } // Fallthrough

    default:
      console.log("Usage:");
      console.log(
        `  ${command} fetch [--stable | --prerelease | --dev | --branch] – clone remote TS repository`
      );
      console.log(
        `  ${command} patch [--type-depth] [--package-name] [--package-make-public] – patch the cloned TS repo`
      );
      console.log(`  ${command} build [--dev] – build the patched TypeScript`);
      console.log(
        `  ${command} publish [--otp=<otp>] – publish the patched TS package to NPM`
      );
      console.log(`  ${command} clean – delete the TypeScript folder`);
      console.log(`  ${command} help <subcommand> – show subcommand usage`);
      console.log();
      if (args[0] !== "help") process.exit(1);
  }
}

//
// Implementations

type GetOpt = { branch: string } | { latest: "stable" | "prerelease" | "dev" };

/**
 * Clone the TypeScript repository
 */
export async function get(opt: GetOpt = { latest: "stable" }) {
  let { branch, latest } = fields(opt);

  const args: string[] = [];

  if (latest === "stable") {
    const res = await fetch(
      "https://api.github.com/repos/microsoft/TypeScript/releases/latest"
    );
    const { tag_name } = await res.json();
    branch = tag_name;
  }

  if (latest === "prerelease") {
    const res = await fetch(
      "https://api.github.com/repos/microsoft/TypeScript/releases"
    );
    const [{ tag_name }] = await res.json();
    branch = tag_name;
  }

  if (branch) {
    args.push("--branch", branch);
    console.log(`Will clone TypeScript version: ${branch}`);
  } else {
    console.log(`Will clone the latest commit.`);
  }

  $.cwd();
  await $`git clone --depth=1 https://github.com/microsoft/TypeScript.git ${args}`;
}

/**
 * Delete the TypeScript repository
 */
export async function clean() {
  $.cwd();

  await $`rm -rf ./TypeScript`;
}

/**
 * Patch the type instantiation depth
 */
export async function patchTypeDepth(newDepth = 1000) {
  $.cwd();

  const path = "./TypeScript/src/compiler/checker.ts";
  const source = await Bun.file(path).text();

  const pattern = /(?<!\w)instantiationDepth === \d+/g;
  const replacer = `instantiationDepth === ${newDepth}`;

  Bun.write(path, source.replaceAll(pattern, replacer));
}

/**
 * Patch the package name in package.json
 */
export async function patchPackageJson({
  name,
  publicAccess,
}: {
  name?: string;
  publicAccess?: boolean;
}) {
  $.cwd();

  const path = "./TypeScript/package.json";
  let contents = await Bun.file(path).json();

  if (name !== undefined) {
    contents = { ...contents, name };
  }

  if (publicAccess) {
    contents = {
      ...contents,
      publishConfig: { ...contents.publishConfig, access: "public" },
    };
  }

  Bun.write(path, JSON.stringify(contents, undefined, 4) + "\n");
}

/**
 * Build the package for publishing to NPM
 */
export async function build({ dev }: { dev?: boolean } = {}) {
  $.cwd("./TypeScript");

  await $`corepack npm ci`;
  if (dev) await $`corepack npx hereby configure-nightly`;
  await $`corepack npx hereby LKG`;
}

/**
 * Publish the package to NPM
 */
export async function publish({ otp }: { otp?: string } = {}) {
  $.cwd("./TypeScript");

  const args: string[] = otp ? [`--otp`, otp] : [];
  await $`corepack npm publish ${args}`;
}
