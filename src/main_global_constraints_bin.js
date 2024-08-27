const fs = require("fs");
const version = require("../package").version;

const { writeGlobalConstraintsBinFile } = require("./stark/chelpers/globalConstraints/globalConstraints.js");

const argv = require("yargs")
    .version(version)
    .usage("node main_build_globalconstraints_bin.js -c <globalconstraintsinfo> -b <binfile>")
    .alias("g", "globalconstraintsinfo")
    .alias("b", "binfile")
    .argv;

async function run() {
    const globalConstraintsInfoFile = typeof (argv.globalconstraintsinfo) === "string" ? argv.globalconstraintsinfo.trim() : "mycircuit.globalconstraintsinfo.json";
    const binFile = typeof (argv.binfile) === "string" ? argv.binfile.trim() : undefined;

    if(!binFile) throw new Error("You must provide a binfile");
    
    const globalConstraintsInfo = JSON.parse(await fs.promises.readFile(globalConstraintsInfoFile, "utf8"));

    await writeGlobalConstraintsBinFile(globalConstraintsInfo, binFile);

    console.log("files Generated Correctly");
}

run().then(() => {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
