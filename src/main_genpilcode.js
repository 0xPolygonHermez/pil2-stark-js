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
        console.log("--------------------- POLYNOMIALS INFO ---------------------")
        let nColumnsBaseField = 0;
        let nColumns = 0;
        let summary = `SUMMARY | ${pil.name} `;
        for(let i = 1; i <= res.nStages + 1; ++i) {
            let stage = i;
            let stageDebug = i === res.nStages + 1 ? "Q" : stage;
            let stageName = "cm" + stage;
            let nColsStage = res.cmPolsMap.filter(p => p.stage == stage).length;
            nCols[stageName] = nColsStage;
            let nColsBaseField = res.mapSectionsN[stageName];
            let imPols = res.cmPolsMap.filter(p => p.stage == stage && p.imPol);
            if(i === res.nStages + 1 || (i < res.nStages && !res.imPolsStages)) {
                console.log(`Columns stage ${stageDebug}: ${nColsStage} -> Columns in the basefield: ${nColsBaseField}`);
            } else {
                console.log(`Columns stage ${stageDebug}: ${nColsStage} (${imPols.length} intermediate polynomials) -> Columns in the basefield: ${nColsBaseField} (${imPols.reduce((acc, curr) => acc + curr.dim, 0)} from intermediate polynomials)`);
            }
            if(i < res.nStages + 1) {
                summary += `| Stage${i}: ${nColsBaseField} `;
                
            }
            nColumns += nColsStage;
            nColumnsBaseField += nColsBaseField;
        }

        const imPols = res.cmPolsMap.filter(p => p.imPol);
        summary += `| ImPols: ${imPols.length} => ${imPols.reduce((acc, curr) => acc + curr.dim, 0)} = ${imPols.filter(i => i.dim === 1).reduce((acc, curr) => acc + curr.dim, 0)} + ${imPols.filter(i => i.dim === 3).reduce((acc, curr) => acc + curr.dim, 0)} `;
        
        summary += `| Total: ${nColumnsBaseField} | nConstraints: ${constraints.length} | nEvals: ${res.evMap.length}`;
        
        console.log(`Total Columns: ${nColumns} -> Columns in the basefield: ${nColumnsBaseField}`);
        console.log(`Total Constraints: ${constraints.length}`)
        if(!options.debug) console.log(`Number of evaluations: ${res.evMap.length}`)
        console.log("------------------------------------------------------------")
        console.log(summary);
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

