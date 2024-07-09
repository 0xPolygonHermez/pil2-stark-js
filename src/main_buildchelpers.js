const fs = require("fs");
const version = require("../package").version;

const {buildCHelpers} = require("./stark/chelpers/stark_chelpers.js");
const { writeCHelpersFile } = require("./stark/chelpers/binFile.js");
const path = require("path");

const argv = require("yargs")
    .version(version)
    .usage("node main_buildchelpers.js -s <starkinfo.json> -e <expressionsinfo> -c <chelpers.cpp> [-C <classname>]")
    .alias("s", "starkinfo")
    .alias("e", "expressionsinfo")
    .alias("c", "chelpers")
    .alias("C", "cls")
    .alias("b", "binfile")
    .alias("g", "genericbinfile")
    .argv;

async function run() {
    let cls = typeof (argv.cls) === "string" ? argv.cls.trim() : "Stark";
    const starkInfoFile = typeof (argv.starkinfo) === "string" ? argv.starkinfo.trim() : "mycircuit.starkinfo.json";
    const expressionsInfoFile = typeof (argv.expressionsinfo) === "string" ? argv.expressionsinfo.trim() : "mycircuit.expressionsinfo.json";
    const cHelpersFile = typeof (argv.chelpers) === "string" ? argv.chelpers.trim() : "mycircuit.chelpers";
    const binFile = typeof (argv.binfile) === "string" ? argv.binfile.trim() : undefined;
    const genericBinFile = typeof (argv.genericbinfile) === "string" ? argv.genericbinfile.trim() : undefined;

    if(!binFile && !genericBinFile) {
        throw new Error("You must provide either a binfile or a genericbinfile");
    }
    
    const starkInfo = JSON.parse(await fs.promises.readFile(starkInfoFile, "utf8"));
    const expressionsInfo = JSON.parse(await fs.promises.readFile(expressionsInfoFile, "utf8"));

    const res = await buildCHelpers(starkInfo, expressionsInfo, binFile, genericBinFile, cls);

    if(res.binFileInfo) {
        const baseDir = path.dirname(cHelpersFile);
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }
        await fs.promises.writeFile(cHelpersFile, res.cHelpers, "utf8");
        
        await writeCHelpersFile(binFile, res.binFileInfo);
    }

    if(genericBinFile) {
        await writeCHelpersFile(genericBinFile, res.genericBinFileInfo);
    }
    
    console.log("files Generated Correctly");
}

run().then(() => {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
