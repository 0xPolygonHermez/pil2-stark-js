const { genRecursive } = require('./genrecursive');
const version = require("../package").version;
const fs = require("fs");

const argv = require("yargs")
    .version(version)
    .usage("node main_genrecursive.js -v <basic_verification_keys.json> -g globalinfo.json -s starkinfo.json -b <starkinfobasic.json> -o <recursive.circom> [--hasCompressor] ")
    .alias("v", "vksbasics").array("v")
    .alias("s", "starkinfo")
    .alias("g", "globalinfo")
    .alias("o", "output")
    .string("template")
    .argv;

async function run() {
    const outputFile = typeof(argv.output) === "string" ?  argv.output.trim() : "mycircuit.circom";
    const globalInfoFile = typeof(argv.globalinfo) === "string" ? argv.globalinfo.trim() : "mycircuit.globalinfo.json";
    const starkInfoFile = typeof (argv.starkinfo) === "string" ? argv.starkinfo.trim() : "mycircuit.starkinfo.json";

    const starkInfo = JSON.parse(await fs.promises.readFile(starkInfoFile, "utf8"));
    const globalInfo = JSON.parse(await fs.promises.readFile(globalInfoFile, "utf8"));

    const vks = [];

    for(let i = 0; i < argv.vksbasics.length; i++) {

        const verKey = JSONbig.parse(await fs.promises.readFile(argv.vksbasics[i], "utf8"));
        const constRoot = verKey.constRoot;

        vks.push(constRoot);
    }

    const verifierCircuitName = argv.verifierCircuitName;
    const subproofId = argv.subproofId;
    const hasCompressor = argv.hasCompressor;
    const verifier = await genRecursive(argv.template, subproofId, verifierCircuitName, vks, starkInfo, globalInfo, hasCompressor)

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
