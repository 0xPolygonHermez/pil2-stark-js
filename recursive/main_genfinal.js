const fs = require("fs");
const { genFinal } = require("./genfinal");
const version = require("../package").version;

const argv = require("yargs")
    .version(version)
    .usage("node main_genfinal.js -g globalinfo.json -s recursivef_stark_infos.json -o <final.circom> ")
    .alias("s", "starkinfos").array("s")
    .alias("v", "verifierCircuitsName").array("s")
    .alias("g", "globalinfo")
    .alias("o", "output")
    .argv;

async function run() {
    const outputFile = typeof(argv.output) === "string" ?  argv.output.trim() : "mycircuit.circom";
    
    const globalInfoFile = typeof(argv.globalinfo) === "string" ? argv.globalinfo.trim() : "mycircuit.globalinfo.json";
    const globalInfo = JSON.parse(await fs.promises.readFile(globalInfoFile, "utf8"));

    const starkInfoRecursivesF = [];

    for(let i = 0; i < argv.starkinfos.length; i++) {
        const starkInfo = JSON.parse(await fs.promises.readFile(argv.starkinfos[i], "utf8"));
        starkInfo.finalSubproofId = i;
        starkInfoRecursivesF.push(starkInfo);
    }

    if(!argv.subproofNames) throw new Error("Subproof names missing");

    const verifiersNames = [];
    for(let i = 0; i < argv.subproofNames.length; i++) {
        verifiersNames.push(`recursivef_${argv.subproofNames}`);
    }

    const verifier = await genFinal(globalInfo, starkInfoRecursivesF, verifiersNames);

    await fs.promises.writeFile(outputFile, verifier, "utf8");

    console.log("file Generated Correctly");

}
run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
