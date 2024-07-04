const {calculateIntermediatePolynomials, addIntermediatePolynomials} = require("./imPolsCalculation/imPolynomials");

const { preparePil } = require("./preparePil");
const { generatePilCode } = require("./code/generatePilCode");
const map = require("./helpers/map");

module.exports.pilInfo = function pilInfo(F, pil, starkStruct, options = {}) {
    const infoPil = preparePil(F, pil, starkStruct, options);
    
    const expressions = infoPil.expressions;
    const constraints = infoPil.constraints;
    const hints = infoPil.hints;
    const symbols = infoPil.symbols;
    const res = infoPil.res;
    
    let newExpressions = expressions;
    let maxDeg = (1 << (res.starkStruct.nBitsExt- res.starkStruct.nBits)) + 1;

    if(!options.debug || !options.skipImPols) {
        const imInfo = calculateIntermediatePolynomials(expressions, res.cExpId, maxDeg, res.qDim);
        addIntermediatePolynomials(res, expressions, constraints, symbols, imInfo.imExps, imInfo.qDeg);
        newExpressions = imInfo.newExpressions;
    }
    
    map(res, symbols, expressions, constraints, options);       

    const {expressionsInfo, verifierInfo} = generatePilCode(res, symbols, constraints, newExpressions, hints, options.debug);
    
    let nCols = {}; 
    
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
        
    delete res.nCommitments;
    delete res.imPolsStages;
    delete res.pilPower;

    return {pilInfo: res, expressionsInfo, verifierInfo};

}
