const path = require("path");
const version = require("../../../package").version;

const smPlookup = require("../sm_plookup/sm_plookup.js");
const smFibonacci = require("../sm_fibonacci/sm_fibonacci.js");
const smPermutation = require("../sm_permutation/sm_permutation.js");
const smConnection = require("../sm_connection/sm_connection.js");
const fs = require("fs");

const F3g = require("../../../src/helpers/f3g.js");
const { compile } = require("pilcom");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const argv = require("yargs")
    .version(version)
    .usage("node main_exec_all.js -o <all.commit> -i <fibonacci.input.json> -p <publics.json>")
    .alias("o", "output")
    .alias("i", "input")
    .alias("p", "publics")
    .string("curve")
    .argv;

async function run() {

    const outputFile = typeof(argv.output) === "string" ?  argv.output.trim() : "all.commit";
    const inputFile = typeof(argv.input) === "string" ?  argv.input.trim() : "input.json";
    const publicsFile = typeof(argv.publics) === "string" ?  argv.publics.trim() : "fibonacci.publics.json";

    const N = Object.values(pil.references)[0].polDeg;

    const F = new F3g();
    const pil = await compile(F, path.join(__dirname, "all_main.pil"));
    const cmPols = generateWtnsCols(pil.references, N, false);

    const input = JSON.parse(await fs.promises.readFile(inputFile, "utf8"));

    await smPlookup.execute(N, cmPols.Plookup);
    await smFibonacci.execute(N, cmPols.Fibonacci, input, F);
    await smPermutation.execute(N, cmPols.Permutation);
    await smConnection.execute(N, cmPols.Connection);

    await cmPols.saveToFile(outputFile);

    const publics = [];
    publics.push(cmPols.Fibonacci.l2[0]);
    publics.push(cmPols.Fibonacci.l1[0]);
    publics.push(cmPols.Fibonacci.l1[N - 1]);

    await fs.promises.writeFile(publicsFile, JSONbig.stringify(publics, null, 1), "utf8");

    console.log("file Generated Correctly");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

