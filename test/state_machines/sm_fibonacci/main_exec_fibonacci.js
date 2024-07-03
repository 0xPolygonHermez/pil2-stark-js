const fs = require("fs");
const path = require("path");
const version = require("../../../package").version;

const smFibonacci = require("./sm_fibonacci.js");

const F3g = require("../../../src/helpers/f3g");
const { F1Field, getCurveFromName } = require("ffjavascript");

const { compile } = require("pilcom");
const { generateWtnsCols } = require("../../../src/witness/witnessCalculator.js");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const argv = require("yargs")
    .version(version)
    .usage("node main_exec_fibonacci.js -o <fibonacci.commit.bin> -i <fibonacci.input.json> -p <fibonacci.publics.json>")
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
    
    const pil = await compile(F, path.join(__dirname, "fibonacci_main.pil"));

    const input = JSON.parse(await fs.promises.readFile(inputFile, "utf8"));

    const N = Object.values(pil.references)[0].polDeg;

    const cmPols = generateWtnsCols(pil.references, N, false);

    const result = await smFibonacci.execute(N, cmPols.Fibonacci, input, F);
    console.log("Result: " + result);

    const publics = [];
    publics.push(cmPols.Fibonacci.l2[0]);
    publics.push(cmPols.Fibonacci.l1[0]);
    publics.push(cmPols.Fibonacci.l1[N - 1]);

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

