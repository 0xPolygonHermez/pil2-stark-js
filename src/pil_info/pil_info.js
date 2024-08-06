const {calculateIntermediatePolynomials, addIntermediatePolynomials} = require("./imPolsCalculation/imPolynomials");

const { preparePil } = require("./helpers/preparePil");
const { generatePilCode } = require("./helpers/generatePilCode");
const map = require("./map");

const fs = require("fs");
const path = require("path");

const util = require('util');
const childProcess = require('child_process'); // Split into two lines for clarity

const exec = util.promisify(childProcess.exec);
const {tmpName} = require("tmp-promise");

module.exports = async function pilInfo(F, pil, stark = true, pil2 = true, starkStruct, options = {}) {
    const infoPil = preparePil(F, pil, starkStruct, stark, pil2, options);
    
    const expressions = infoPil.expressions;
    const constraints = infoPil.constraints;
    const hints = infoPil.hints;
    const symbols = infoPil.symbols;
    const res = infoPil.res;
    
    let newExpressions = expressions;
    let maxDeg;
    if(stark) {
        maxDeg = (1 << (res.starkStruct.nBitsExt- res.starkStruct.nBits)) + 1;
    } else {
        maxDeg = Math.pow(2,3) + 1;
    }
    if(!options.debug || !options.skipImPols) {
        let imInfo;

        if(options.optImPols) {
            const infoPilFile = await tmpName();
            const imPolsFile = await tmpName();

            let maxDeg =  (1 << (starkStruct.nBitsExt - starkStruct.nBits)) + 1;

            const infoPilJSON = { maxDeg, cExpId: infoPil.res.cExpId, qDim: infoPil.res.qDim, ...infoPil };

            await fs.promises.writeFile(infoPilFile, JSON.stringify(infoPilJSON, null, 1), "utf8");

            const calculateImPolsPath = path.resolve(__dirname, './imPolsCalculation/calculateImPols.py');

            const { stdout } = await exec(`python3 ${calculateImPolsPath} ${infoPilFile} ${imPolsFile}`);
            console.log(stdout);

            imInfo = JSON.parse(await fs.promises.readFile(imPolsFile, "utf8"));

            fs.promises.unlink(infoPilFile); 
            fs.promises.unlink(imPolsFile);
        } else {
            imInfo = calculateIntermediatePolynomials(expressions, res.cExpId, maxDeg, res.qDim);
        }
        
        newExpressions = imInfo.newExpressions;
        addIntermediatePolynomials(res, newExpressions, constraints, symbols, imInfo.imExps, imInfo.qDeg, stark);
    }
    
    map(res, symbols, expressions, constraints, options);       

    const {expressionsInfo, verifierInfo} = generatePilCode(res, symbols, constraints, newExpressions, hints, options.debug, stark);
    
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
        if(!options.debug) console.log(`Number of evaluations: ${res.evMap.length}`)
        console.log("------------------------------------------------------------")
    }
        
    delete res.nCommitments;
    delete res.imPolsStages;
    delete res.pilPower;

    return {pilInfo: res, expressionsInfo, verifierInfo};

}
