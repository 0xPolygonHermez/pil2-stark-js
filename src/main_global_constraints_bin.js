const fs = require("fs");
const version = require("../package").version;

const { writeGlobalConstraintsBinFile } = require("./stark/chelpers/globalConstraints/globalConstraints.js");

const argv = require("yargs")
    .version(version)
    .usage("node main_build_expressions_bin.js -g <starkinfo.json> -e <expressionsinfo> -b <binfile>")
    .alias("g", "globalinfo")
    .alias("c", "constraintsinfo")
    .alias("b", "binfile")
    .argv;

async function run() {
    const globalInfoFile = typeof (argv.globalinfo) === "string" ? argv.globalinfo.trim() : "mycircuit.globalinfo.json";
    const constraintsInfoFile = typeof (argv.constraintsinfo) === "string" ? argv.constraintsinfo.trim() : "mycircuit.expressionsinfo.json";
    const binFile = typeof (argv.binfile) === "string" ? argv.binfile.trim() : undefined;

    if(!binFile) throw new Error("You must provide a binfile");
    
    const globalInfo = JSON.parse(await fs.promises.readFile(globalInfoFile, "utf8"));
    const constraintsInfo = JSON.parse(await fs.promises.readFile(constraintsInfoFile, "utf8"));

    await writeGlobalConstraintsBinFile(globalInfo, constraintsInfo, binFile);

    console.log("files Generated Correctly");
}

run().then(() => {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
