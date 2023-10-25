const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const { Transcript } = require('./templates/transcript');
const version = require("../package").version;

const argv = require("yargs")
    .version(version)
    .usage("node main_genrecursive.js -v <basic_verification_keys.json> -g globalinfo.json -s starkinfo.json -b <starkinfobasic.json> -o <recursive.circom> [--hasCompressor] ")
    .alias("v", "vksbasics").array("v")
    .alias("s", "starkinfo")
    .alias("b", "starkinfobasic")
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

    if(!globalInfo) throw new Error("Global info is undefined");
    if(!globalInfo.nPublics) throw new Error("Global info does not contain number of publics");
    if(!globalInfo.numChallenges) throw new Error("Global info does not contain number of challenges");
    if(!globalInfo.starkStruct.steps) throw new Error("Global info does not contain number of fri steps");

    const nPublics = globalInfo.nPublics;
    const nChallengesStages = globalInfo.numChallenges;
    const stepsFRI = globalInfo.starkStruct.steps;

    const vks = [];

    for(let i = 0; i < argv.vksbasics.length; i++) {

        const verKey = JSONbig.parse(await fs.promises.readFile(argv.vksbasics[i], "utf8"));
        const constRoot = verKey.constRoot;

        vks.push(constRoot);
    }

    if(!["compressor", "recursive1", "recursive2", "recursivef"].includes(argv.template)) throw new Error(`Invalid template: ${argv.template}`);
    const template = await fs.promises.readFile(path.join(__dirname, "templates", `${argv.template}.circom.ejs`), "utf8");

    const hasCompressor = argv.template === "recursive1" ? argv.hasCompressor || false : false;

    const obj = {
        starkInfo,
        vks,
        hasCompressor,
        nPublics,
        nChallengesStages,
        stepsFRI,
    };

    if((argv.template === "recursive1" && !hasCompressor) || argv.template === "compressor") {
        if(!("circuitType" in argv)) throw new Error("If there is no compressor, circuitType must be provided");
        if(!("aggregationType" in argv)) throw new Error("If there is no compressor, aggregationType must be provided");
        if(!("basicCircuitName" in argv)) throw new Error("If there is a compressor, basic circuit name must be provided");

        obj.circuitType = Number(argv.circuitType);
        obj.aggregationType = Number(argv.aggregationType);
        obj.basicCircuitName = argv.basicCircuitName;
        obj.starkInfoBasic = starkInfo;

        obj.transcriptPublics = new Transcript("publics");
        obj.transcriptEvals = new Transcript("evals");
        obj.transcriptFinalPol = new Transcript("finalPol");

    } else if(argv.template === "recursive1") {
        if(!("starkinfobasic" in argv)) throw new Error("If there is a compressor, starkInfoBasic must be provided");
        const starkInfoBasicFile = typeof (argv.starkinfobasic) === "string" ? argv.starkinfobasic.trim() : "mycircuitBasic.starkinfo.json";
        const starkInfoBasic = JSON.parse(await fs.promises.readFile(starkInfoBasicFile, "utf8"));
        obj.starkInfoBasic = starkInfoBasic;
    }
    
    const verifier = ejs.render(template,  obj);

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
