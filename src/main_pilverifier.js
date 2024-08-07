const fs = require("fs");
const path = require("path");
const version = require("../package").version;

const protobuf = require('protobufjs');

const { compile } = require("pilcom");
const compilePil2 = require("pil2-compiler/src/compiler.js");

const { F1Field, getCurveFromName } = require("ffjavascript");
const { starkGen } = require("..");
const F3g = require("./helpers/f3g");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const Logger = require('logplease');
const { generateFixedCols, generateWtnsCols } = require("./witness/witnessCalculator");

const argv = require("yargs")
    .version(version)
    .usage("main_pilverifier.js -t <commit.bin> -p <pil.json> -c <constant.bin>")
    .alias("p", "pil")
    .alias("m", "commit")
    .alias("c", "constant")
    .alias("P", "config")
    .alias("i", "input")
    .alias("v", "verbose")
    .alias("l", "pil2")
    .alias("s", "starkinfo")
    .alias("e", "expressionsinfo")
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
    const inputsFile = typeof(argv.input) === "string" ? argv.input.trim() : [];
    const starkInfoFile = typeof(argv.starkinfo) === "string" ?  argv.starkinfo.trim() : "mycircuit.starkinfo.json";
    const expressionsInfoFile = typeof(argv.expressionsinfo) === "string" ?  argv.expressionsinfo.trim() : "mycircuit.expressionsinfo.json";

    const config = typeof(argv.config) === "string" ? JSON.parse(fs.readFileSync(argv.config.trim())) : {};

    const pil2 = argv.pil2 || false;

    let constPols;
    let cmPols;
    let pil;
    if(pil2) {
        const tmpPath = path.resolve(__dirname, '../tmp');
        const piloutPath = path.join(tmpPath, "pilout.ptb");
        if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
        let pilConfig = { outputFile: piloutPath };
        compilePil2(F, pilFile, null, pilConfig);
        
        const piloutEncoded = fs.readFileSync(piloutPath);
        const pilOutProtoPath = path.resolve(__dirname, '../node_modules/pil2-compiler/src/pilout.proto');
        const PilOut = protobuf.loadSync(pilOutProtoPath).lookupType("PilOut");
        let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
        
        pil = pilout.subproofs[0].airs[0];
        pil.symbols = pilout.symbols;
        pil.numChallenges = pilout.numChallenges;
        pil.hints = pilout.hints;
        pil.airId = 0;
        pil.subproofId = 0;

        constPols = generateFixedCols(pil.symbols, pil.numRows);
        cmPols = generateWtnsCols(pil.symbols, pil.numRows);
    } else {
        pil = await compile(F, pilFile, null, config);

        let N = Object.values(pil.references)[0].polDeg;
        
        constPols = generateFixedCols(pil.references, N, false);
        cmPols = generateWtnsCols(pil.references, N, false);
    }
    
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

    const verificationHashType = curveName.toUpperCase();
    const splitLinearHash = false;

    const inputs = JSONbig.parse(await fs.promises.readFile(inputsFile, "utf8"));

    const optionsPilVerify = {logger, debug: true, useThreads: false, parallelExec: false, verificationHashType, splitLinearHash};
    
    const starkInfo = JSON.parse(await fs.promises.readFile(starkInfoFile, "utf8"));
    const expressionsInfo = JSON.parse(await fs.promises.readFile(expressionsInfoFile, "utf8"));

    await starkGen(cmPols, constPols, {}, starkInfo, expressionsInfo, inputs, optionsPilVerify);
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
