const fs = require("fs");
const path = require("path");
const version = require("../../../package").version;

const smSimple = require("./sm_simple.js");

const F3g = require("../../../src/helpers/f3g");
const { F1Field, getCurveFromName } = require("ffjavascript");
const { compile } = require("pilcom");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });


const argv = require("yargs")
    .version(version)
    .usage("node main_exec_simple.js -o <simple.commit.bin> -p <simple.publics.json>")
    .alias("o", "output")
    .alias("p", "publics")
    .string("curve")
    .argv;

async function run() {

    const outputFile = typeof(argv.output) === "string" ?  argv.output.trim() : "simple.commit";
    const publicsFile = typeof(argv.publics) === "string" ?  argv.publics.trim() : "simple.publics.json";

    if(argv.curve && !["gl", "bn128"].includes(argv.curve)) throw new Error("Curve not supported");
    
    const curveName = argv.curve || "gl";
    const F = curveName === "gl" ? new F3g() : new F1Field(21888242871839275222246405745257275088548364400416034343698204186575808495617n);

    if(argv.simple && !["1","2","2p","3","4","4p"].includes(argv.simple.toString())) throw new Error("Simple " + argv.simple.toString() + " does not exist" );
    const simple = argv.simple.toString() || "2";
    const pil = await compile(F, path.join(__dirname, "simple" + simple + ".pil"));

    const N = pil.references[Object.keys(pil.references)[0]].polDeg;
    
    const cmPols = generateWtnsCols(pil.references, N, false);

    await smSimple.execute(N, cmPols.Simple, F);

    if(curveName === "gl"){
        await cmPols.saveToFile(outputFile);
    } else {
        const curve = await getCurveFromName("bn128");

    	const Fr = curve.Fr;

    	await curve.terminate();

        await cmPols.saveToFileFr(outputFile, Fr);
    }

    if(argv.simple.toString().includes("2p")) {
        const publics = [];
        publics.push(cmPols.Simple.b[N - 1]);
        publics.push(cmPols.Simple.b[N - 2]);

        await fs.promises.writeFile(publicsFile, JSONbig.stringify(publics, null, 1), "utf8");

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

