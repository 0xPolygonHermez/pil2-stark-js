const {calculateIntermediatePolynomials, addIntermediatePolynomials} = require("./helpers/polynomials/imPolynomials");

const { preparePil } = require("./helpers/preparePil");
const { generatePilCode } = require("./helpers/generatePilCode");
const map = require("./map");

module.exports = function pilInfo(F, pil, stark = true, pil2 = true, starkStruct, options = {}) {

    const infoPil = preparePil(F, pil, starkStruct, stark, pil2, options);
    
    const expressions = infoPil.expressions;
    const constraints = infoPil.constraints;
    const hints = infoPil.hints;
    const symbols = infoPil.symbols;
    const res = infoPil.res;
    
    let newExpressions;
    if(!options.debug) {
        let maxDeg;
        if(stark) {
            maxDeg = (1 << (res.starkStruct.nBitsExt- res.starkStruct.nBits)) + 1;
        } else {
            maxDeg = Math.pow(2,3) + 1;
        }
        const imInfo = calculateIntermediatePolynomials(expressions, res.cExpId, maxDeg, res.qDim);
        addIntermediatePolynomials(res, expressions, constraints, symbols, imInfo.imExps, imInfo.qDeg, stark);
        newExpressions = imInfo.newExpressions;
    } else {
        newExpressions = expressions;
    }
    
    for(let i = 0; i < newExpressions.length; i++) {
        if(newExpressions[i].keep && !newExpressions[i].imPol) {
            const symbol = { type: "tmpPol", name: `tmpPol${i}`, expId: i, stage: newExpressions[i].stage, dim: newExpressions[i].dim, subproofId: res.subproofId, airId: res.airId };
            symbols.push(symbol);
        }    
    }

    map(res, symbols, stark, options.debug);       

    const expressionsInfo = generatePilCode(res, symbols, constraints, newExpressions, hints, options.debug, stark);
    
    res.nCols = {}; 
    if(stark) {
        console.log("--------------------- POLINOMIALS INFO ---------------------")
        let nColumnsBaseField = 0;
        let nColumns = 0;
        for(let i = 1; i <= res.nStages + 1; ++i) {
            let stage = i;
            let stageName = "cm" + stage;
            let nCols = res.cmPolsMap.filter(p => p.stage == stageName).length;
            res.nCols[stageName] = nCols;
            let nColsBaseField = res.mapSectionsN[stageName];
            if(i === res.nStages + 1 || (i < res.nStages && !res.imPolsStages)) {
                console.log(`Columns stage ${stage}: ${nCols} -> Columns in the basefield: ${nColsBaseField}`);
            } else {
                console.log(`Columns stage ${stage}: ${nCols} (${res.cmPolsMap.filter(p => p.stage == stageName && p.imPol).length} intermediate columns) -> Columns in the basefield: ${nColsBaseField}`);
            }
            nColumns += nCols;
            nColumnsBaseField += nColsBaseField;
        }
        
        res.nCols["tmpExp"] = res.cmPolsMap.filter(p => p.stage == "tmpExp").length;
        console.log(`Total Columns: ${nColumns} -> Total Columns in the basefield: ${nColumnsBaseField}`);
        console.log(`Total Constraints: ${constraints.length}`)
        if(!options.debug) console.log(`Number of evaluations: ${res.evMap.length}`)
        console.log("------------------------------------------------------------")
    }
    
    delete res.nCommitments;
    delete res.cExpId;
    delete res.friExpId;
    delete res.imPolsStages;
    
    return {pilInfo: res, expressionsInfo};

}
