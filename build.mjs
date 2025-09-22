import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
import esbuild from "esbuild";

import { globSync as glob } from "glob";
import packageJson from "./package.json" with { type: "json" };

const SRC_FILES = glob("./src/**/*.ts");
const OUT_DIR = path.resolve("build");
const npmArgs = process.argv.slice(2);

// .npmignore
const NPM_IGNORE = [".*", "*.tgz", "node_modules", "package-lock.json"];

/** Builds */
function build() {
  // node
  for (const format of ["esm", "cjs"]) {
    esbuild.buildSync({
      entryPoints: SRC_FILES,
      outdir: path.join(OUT_DIR, format),
      format: format,
      platform: "node",
      treeShaking: true
    });
  }

  // browser
  esbuild.buildSync({
    globalName: packageJson.name,
    entryPoints: ["./src-browser/index.ts"],
    outfile: path.join(OUT_DIR, `${packageJson.name}.min.js`),
    platform: "browser",
    minify: true,
    bundle: true
  });
}

/**
 * Create module in OUT_DIR
 */
function createModule() {
  console.log("Creating module at " + OUT_DIR);

  // ensure directory exists
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

  // write ignore file
  fs.writeFileSync(path.join(OUT_DIR, ".npmignore"), NPM_IGNORE.join("\n"));

  // copy all the allowed files to the lib directory
  packageJson.files = ["LICENSE", "README.md"].reduce(
    (files, p) => {
      fs.copyFileSync(path.resolve(p), path.join(OUT_DIR, p));
      files.push(p);
      return files;
    },
    ["**/*.js", "**/*.ts", "**/*.json"]
  );

  // clear all dev config
  ["scripts", "devDependencies", "lint-staged"].forEach(
    k => delete packageJson[k]
  );

  // add exports explicitly
  packageJson.exports = {
    "./package.json": "./package.json"
  };
  packageJson.sideEffects = [
    "./cjs/init/system.js",
    "./cjs/init/basic.js",
    "./esm/init/system.js",
    "./esm/init/basic.js"
  ];

  SRC_FILES.filter(s => !s.includes("_")).forEach(s => {
    // strip "src/" (prefix) and ".ts" (suffix)
    s = s.slice(4, -3);
    const isRoot = s === "index";
    const isLeaf = !s.endsWith("/index");
    const name = isRoot ? "." : isLeaf ? s : s.slice(0, -6);
    const outFile = isRoot ? "index" : s;
    const key = isRoot ? "." : "./" + name;
    // exclude distinct operator functions
    if (isLeaf && name.includes("operators")) return;
    // create distributions
    const typesPath = `./types/${outFile}.d.ts`;
    const cjsPath = `./cjs/${outFile}.js`;
    const esmPath = `./esm/${outFile}.js`;

    packageJson.exports[key] = {
      types: typesPath,
      node: cjsPath,
      default: esmPath
    };
  });

  const data = JSON.stringify(packageJson, null, 2);

  // write new package.json for lib
  fs.writeFileSync(path.join(OUT_DIR, "package.json"), data);
}

function main() {
  build();
  createModule();

  if (npmArgs.length) {
    // execute within lib dir
    console.log("\nExecuting command:", `npm ${npmArgs.join(" ")}`, "\n");

    // execute command
    cp.spawnSync("npm", npmArgs, {
      cwd: OUT_DIR,
      env: process.env,
      stdio: "inherit"
    });

    console.log("\nCompleted command\n");

    // if we created a tar file, copy to parent directory
    let tarball = packageJson.name + "-" + packageJson.version + ".tgz";
    let tarballPath = path.join(OUT_DIR, tarball);
    if (fs.existsSync(tarballPath)) {
      console.log("Copying", tarball, "to correct folder");
      fs.renameSync(tarballPath, path.join(path.dirname(OUT_DIR), tarball));
    }
  }
}

main();
