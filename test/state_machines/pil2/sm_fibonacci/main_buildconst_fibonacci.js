const path = require("path");
const version = require("../../../../package").version;
const protobuf = require('protobufjs');
const compilePil2 = require("pil2-compiler/src/compiler.js");

const fs = require("fs");
const { F1Field, getCurveFromName } = require("ffjavascript");
const F3g = require("../../../../src/helpers/f3g.js");

const { getFixedPolsPil2 } = require("../../../../src/pil_info/helpers/pil2/piloutInfo.js");
const { generateFixedCols } = require("../../../../src/witness/witnessCalculator.js");

const argv = require("yargs")
    .version(version)
    .usage("node test/state_machines/pil2/sm_fibonacci/main_buildconst_fibonacci.js -o <fibonacci.const>")
    .alias("o", "output")
    .string("curve")
    .argv;

async function run() {

    const outputFile = typeof(argv.output) === "string" ?  argv.output.trim() : "fibonacci.const";

    if(argv.curve && !["gl", "bn128"].includes(argv.curve)) throw new Error("Curve not supported");
    
    const curveName = argv.curve || "gl";
    const F = curveName === "gl" ? new F3g() : new F1Field(21888242871839275222246405745257275088548364400416034343698204186575808495617n);
    
    const tmpPath = path.resolve(__dirname, '../tmp');
    if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
    let piloutPath = path.join(tmpPath, "pilout.ptb");
    let pilConfig = { outputFile: piloutPath };
    compilePil2(F, path.join(__dirname, "fibonacci.pil"), null, pilConfig);

    const piloutEncoded = fs.readFileSync(piloutPath);
    const pilOutProtoPath = path.resolve(__dirname, '../../../../node_modules/pil2-compiler/src/pilout.proto');
    const PilOut = protobuf.loadSync(pilOutProtoPath).lookupType("PilOut");
    let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
    
    const pil = pilout.subproofs[0].airs[0];
    pil.symbols = pilout.symbols;

    const constPols = generateFixedCols(pil.symbols, pil.numRows);
    getFixedPolsPil2(pil, constPols, F);
    
    if(curveName === "gl"){
        await constPols.saveToFile(outputFile);
    } else {
        const curve = await getCurveFromName("bn128");

    	const Fr = curve.Fr;

    	await curve.terminate();

        await constPols.saveToFileFr(outputFile, Fr);
    }

    console.log("file Generated Correctly");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

