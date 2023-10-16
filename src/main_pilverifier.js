const fs = require("fs");
const version = require("../package").version;

const { compile, newConstantPolsArray, newCommitPolsArray } = require("pilcom");

const { F1Field, getCurveFromName } = require("ffjavascript");
const { pilInfo, starkGen } = require("..");
const F3g = require("./helpers/f3g");

const Logger = require('logplease');

const argv = require("yargs")
    .version(version)
    .usage("main_pilverifier.js -t <commit.bin> -p <pil.json> -c <constant.bin>")
    .alias("p", "pil")
    .alias("m", "commit")
    .alias("c", "constant")
    .alias("P", "config")
    .alias("v", "verbose")
    .string("curve")
    .argv;

async function run() {

    const logger = Logger.create("pil-stark", {showTimestamp: false});
    Logger.setLogLevel("DEBUG");

    const curveName = argv.curve || "gl";

    const F = curveName === "gl" ? new F3g() : new F1Field(21888242871839275222246405745257275088548364400416034343698204186575808495617n);

    const pilFile = typeof(argv.pil) === "string" ?  argv.pil.trim() : "main.pil.json";
    const constantFile = typeof(argv.constant) === "string" ?  argv.constant.trim() : "constant.bin";
    const commitFile = typeof(argv.commit) === "string" ?  argv.commit.trim() : "commit.bin";

    const config = typeof(argv.config) === "string" ? JSON.parse(fs.readFileSync(argv.config.trim())) : {};

    const pil = await compile(F, pilFile, null, config);

    const constPols = newConstantPolsArray(pil, F);
    const cmPols =  newCommitPolsArray(pil, F);

    let Fr;
    if(curveName !== "gl"){
        const curve = await getCurveFromName("bn128");

    	Fr = curve.Fr;

    	await curve.terminate();
    }

    if(curveName !== "gl") {
        await constPols.loadFromFileFr(constantFile, Fr);
        await cmPols.loadFromFileFr(commitFile, Fr);
    } else {	
        await constPols.loadFromFile(constantFile);
        await cmPols.loadFromFile(commitFile);
    }

    const pil1 = true;

    const verificationHashType = curveName.toUpperCase();
    const splitLinearHash = false;

    const optionsPilVerify = {logger, debug: true, useThreads: false, parallelExec: false, verificationHashType, splitLinearHash};
    const starkInfo = pilInfo(F, pil, true, pil1, true, {});
    await starkGen(cmPols, constPols, {}, starkInfo, optionsPilVerify);
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});