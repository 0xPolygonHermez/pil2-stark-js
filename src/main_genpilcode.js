const fs = require("fs");
const version = require("../package").version;

const { generatePilCode } = require("./pil_info/helpers/generatePilCode");
const { addIntermediatePolynomials } = require("./pil_info/imPolsCalculation/imPolynomials");
const map = require("./pil_info/map");

const argv = require("yargs")
    .version(version)
    .usage("node main_genpilcode.js -f <infopil.json> -m <impols.json> -s <starkinfo.json>")
    .alias("f", "infopil")
    .alias("m", "impols")
    .alias("e", "expressionsinfo")
    .alias("v", "verifierinfo")
    .alias("s", "starkinfo")
    .argv;

async function run() {
    const infoPilFile = typeof(argv.infopil) === "string" ?  argv.infopil.trim() : "mycircuit.infopil.json";
    const imPolsFile = typeof(argv.impols) === "string" ?  argv.impols.trim() : "mycircuit.impols.json";

    const starkInfoFile = typeof(argv.starkinfo) === "string" ?  argv.starkinfo.trim() : "mycircuit.starkinfo.json";
    const expressionsInfoFile = typeof(argv.expressionsinfo) === "string" ?  argv.expressionsinfo.trim() : "mycircuit.expressionsinfo.json";
    const verifierInfoFile = typeof(argv.verifierinfo) === "string" ?  argv.verifierinfo.trim() : "mycircuit.verifierInfo.json";

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
    
    const debugLine = argv.debugLine || false;

    map(res, symbols, expressions, constraints, { debugLine });     

    const {expressionsInfo, verifierInfo} = generatePilCode(res, symbols, constraints, expressions, hints, debug, stark);

    delete res.nCommitments;
    delete res.imPolsStages;
    delete res.pilPower;

    let nCols = {}; 
    if(stark) {
        console.log("--------------------- POLINOMIALS INFO ---------------------")
        let nColumnsBaseField = 0;
        let nColumns = 0;
        for(let i = 1; i <= res.nStages + 1; ++i) {
            let stage = i;
            let stageName = "cm" + stage;
            let nColsStage = res.cmPolsMap.filter(p => p.stage == stage).length;
            nCols[stageName] = nColsStage;
            let nColsBaseField = res.mapSectionsN[stageName];
            if(i === res.nStages + 1 || (i < res.nStages && !res.imPolsStages)) {
                console.log(`Columns stage ${stage}: ${nColsStage} -> Columns in the basefield: ${nColsBaseField}`);
            } else {
                console.log(`Columns stage ${stage}: ${nColsStage} (${res.cmPolsMap.filter(p => p.stage == stage && p.imPol).length} intermediate columns) -> Columns in the basefield: ${nColsBaseField}`);
            }
            nColumns += nColsStage;
            nColumnsBaseField += nColsBaseField;
        }
        
        console.log(`Total Columns: ${nColumns} -> Total Columns in the basefield: ${nColumnsBaseField}`);
        console.log(`Total Constraints: ${constraints.length}`)
        console.log(`Number of evaluations: ${res.evMap.length}`)
        console.log("------------------------------------------------------------")
    }

    await fs.promises.writeFile(starkInfoFile, JSON.stringify(res, null, 1), "utf8");

    await fs.promises.writeFile(expressionsInfoFile, JSON.stringify(expressionsInfo, null, 1), "utf8");

    await fs.promises.writeFile(verifierInfoFile, JSON.stringify(verifierInfo, null, 1), "utf8");
    
    console.log("files Generated Correctly");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

