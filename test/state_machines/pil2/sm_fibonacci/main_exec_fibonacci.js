const fs = require("fs");
const path = require("path");
const version = require("../../../../package").version;
const protobuf = require('protobufjs');

const { compile } = require("pilcom2");

const F3g = require("../../../../src/helpers/f3g");
const { F1Field, getCurveFromName } = require("ffjavascript");

const smFibonacci = require("./sm_fibonacci.js");

const { generateWtnsCols } = require("../../../../src/witness/witnessCalculator.js");

const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const argv = require("yargs")
    .version(version)
    .usage("node test/state_machines/pil2/sm_fibonacci/main_exec_fibonacci.js -o <fibonacci.commit.bin> -i <input.json> -p <publics.json>")
    .alias("o", "output")
    .alias("i", "input")
    .alias("p", "publics")
    .string("curve")
    .argv;

async function run() {

    const outputFile = typeof(argv.output) === "string" ?  argv.output.trim() : "fibonacci.commit";
    const inputFile = typeof(argv.input) === "string" ?  argv.input.trim() : "input.json";
    const publicsFile = typeof(argv.publics) === "string" ?  argv.publics.trim() : "fibonacci.publics.json";

    if(argv.curve && !["gl", "bn128"].includes(argv.curve)) throw new Error("Curve not supported");
    
    const curveName = argv.curve || "gl";
    const F = curveName === "gl" ? new F3g() : new F1Field(21888242871839275222246405745257275088548364400416034343698204186575808495617n);
    
    const tmpPath = path.resolve(__dirname, '../tmp');
    if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
    let pilConfig = { piloutDir: tmpPath};
    await compile(F, path.join(__dirname, "fibonacci.pil"), null, pilConfig);

    const piloutEncoded = fs.readFileSync(path.join(tmpPath, "pilout.ptb"));
    const pilOutProtoPath = path.resolve(__dirname, '../../../../node_modules/pilcom2/src/pilout.proto');
    const PilOut = protobuf.loadSync(pilOutProtoPath).lookupType("PilOut");
    let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));

    const pil = pilout.subproofs[0].airs[0];
    pil.symbols = pilout.symbols;

    const cmPols = generateWtnsCols(pil.symbols, pil.numRows);

    const input = JSON.parse(await fs.promises.readFile(inputFile, "utf8"));

    await smFibonacci.execute(pil.numRows, cmPols.Fibonacci, input, F);


    const publics = [];
    publics.push(cmPols.Fibonacci.b[0]);
    publics.push(cmPols.Fibonacci.a[0]);
    publics.push(cmPols.Fibonacci.a[pil.numRows - 1]);
    publics.push(5n);

    await fs.promises.writeFile(publicsFile, JSONbig.stringify(publics, null, 1), "utf8");

    if(curveName === "gl"){
        await cmPols.saveToFile(outputFile);
    } else {
       const curve = await getCurveFromName("bn128");

    	const Fr = curve.Fr;

    	await curve.terminate();

        await cmPols.saveToFileFr(outputFile, Fr);
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

