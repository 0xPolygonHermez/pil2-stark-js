const fs = require("fs");
const version = require("../package").version;

const { generatePilCode } = require("./pil_info/helpers/generatePilCode");
const { addIntermediatePolynomials } = require("./pil_info/helpers/polynomials/imPolynomials");
const map = require("./pil_info/map");

const argv = require("yargs")
    .version(version)
    .usage("node main_genpilcode.js -f <infopil.json> -m <impols.json> -s <starkinfo.json>")
    .alias("f", "infopil")
    .alias("m", "impols")
    .alias("s", "starkinfo")
    .argv;

async function run() {
    const infoPilFile = typeof(argv.infopil) === "string" ?  argv.infopil.trim() : "mycircuit.infopil.json";
    const imPolsFile = typeof(argv.impols) === "string" ?  argv.impols.trim() : "mycircuit.impols.json";

    const starkInfoFile = typeof(argv.starkinfo) === "string" ?  argv.starkinfo.trim() : "mycircuit.starkinfo.json";

    const infoPil = JSON.parse(await fs.promises.readFile(infoPilFile, "utf8"));
    const imPols = JSON.parse(await fs.promises.readFile(imPolsFile, "utf8"));

    const res = infoPil.res;
    const symbols = infoPil.symbols;
    const constraints = infoPil.constraints;
    const hints = infoPil.hints;
    const expressions = imPols.newExpressions;
    const qDeg = imPols.qDeg;
    const imExps = imPols.imExps;

    const stark = true;
    const debug = false;

    addIntermediatePolynomials(res, expressions, constraints, symbols, imExps, qDeg, stark);
    
    for(let i = 0; i < expressions.length; i++) {
        if(expressions[i].keep && !expressions[i].imPol) {
            const symbol = { type: "tmpPol", name: `tmpPol${i}`, expId: i, stage: expressions[i].stage, dim: expressions[i].dim, subproofId: res.subproofId, airId: res.airId };
            symbols.push(symbol);
        }    
    }

    map(res, symbols, stark, debug);     

    const starkInfo = generatePilCode(res, symbols, constraints, expressions, hints, debug, stark);

    delete starkInfo.nCommitments;
    delete starkInfo.cExpId;
    delete starkInfo.friExpId;

    await fs.promises.writeFile(starkInfoFile, JSON.stringify(starkInfo, null, 1), "utf8");

    console.log("files Generated Correctly");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

