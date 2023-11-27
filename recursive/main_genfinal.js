const fs = require("fs");
const { genFinal } = require("./genfinal");
const version = require("../package").version;

const argv = require("yargs")
    .version(version)
    .usage("node main_genfinal.js -g globalinfo.json -s recursive2_stark_infos.json -o <final.circom> ")
    .alias("s", "starkinfos").array("s")
    .alias("v", "verificationkeys").array("v")
    .alias("g", "globalinfo")
    .alias("o", "output")
    .argv;

async function run() {
    const outputFile = typeof(argv.output) === "string" ?  argv.output.trim() : "mycircuit.circom";
    
    const globalInfoFile = typeof(argv.globalinfo) === "string" ? argv.globalinfo.trim() : "mycircuit.globalinfo.json";
    const globalInfo = JSON.parse(await fs.promises.readFile(globalInfoFile, "utf8"));

    const starkInfoRecursives2 = [];

    if(argv.starkinfos.length !== argv.verificationkeys.length) {
        throw new Error("The number of stark infos and verification keys must be the same");
    }

    for(let i = 0; i < argv.starkinfos.length; i++) {
        const starkInfo = JSON.parse(await fs.promises.readFile(argv.starkinfos[i], "utf8"));
        const verificationKeys = JSON.parse(await fs.promises.readFile(argv.verificationkeys[i], "utf8"));

        starkInfo.finalSubproofId = i;
        const res = { 
            starkInfo, 
            rootCRecursive2: verificationKeys.rootCRecursive2, 
            rootCRecursives1: verificationKeys.rootCRecursives1 
        };
        starkInfoRecursives2.push(res);
    }

    const verifier = await genFinal(globalInfo, starkInfoRecursives2);

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
