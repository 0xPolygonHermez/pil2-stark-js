const fs = require("fs");
const version = require("../package").version;

const {prepareExpressionsBin} = require("./stark/chelpers/stark_chelpers.js");
const { writeExpressionsBinFile } = require("./stark/chelpers/binFile.js");

const argv = require("yargs")
    .version(version)
    .usage("node main_build_expressions_bin.js -s <starkinfo.json> -e <expressionsinfo> -c <chelpers.cpp>")
    .alias("s", "starkinfo")
    .alias("e", "expressionsinfo")
    .alias("b", "binfile")
    .argv;

async function run() {
    const starkInfoFile = typeof (argv.starkinfo) === "string" ? argv.starkinfo.trim() : "mycircuit.starkinfo.json";
    const expressionsInfoFile = typeof (argv.expressionsinfo) === "string" ? argv.expressionsinfo.trim() : "mycircuit.expressionsinfo.json";
    const binFile = typeof (argv.binfile) === "string" ? argv.binfile.trim() : undefined;

    if(!binFile) throw new Error("You must provide a binfile");
    
    const starkInfo = JSON.parse(await fs.promises.readFile(starkInfoFile, "utf8"));
    const expressionsInfo = JSON.parse(await fs.promises.readFile(expressionsInfoFile, "utf8"));

    const res = await prepareExpressionsBin(starkInfo, expressionsInfo);

    await writeExpressionsBinFile(binFile, res);
    
    console.log("files Generated Correctly");
}

run().then(() => {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
