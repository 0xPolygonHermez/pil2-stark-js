const {calculateIntermediatePolynomials, addIntermediatePolynomials} = require("./helpers/polynomials/imPolynomials");

const { preparePil } = require("./helpers/preparePil");
const { generatePilCode } = require("./helpers/generatePilCode");
const map = require("./map");

module.exports = function pilInfo(F, pil, stark = true, pil2 = true, starkStruct, options = {}) {

    const infoPil = preparePil(F, pil, starkStruct, stark, pil2, options);

    const imPolsLastStage = options.imPolsLastStage || true;

    const expressions = infoPil.expressions;
    const constraints = infoPil.constraints;
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
        addIntermediatePolynomials(res, expressions, constraints, symbols, imInfo.imExps, imInfo.qDeg, stark, imPolsLastStage);
        newExpressions = imInfo.newExpressions;
    } else {
        newExpressions = expressions;
    }
    
    map(res, symbols, newExpressions, stark, options.debug);       

    generatePilCode(res, symbols, constraints, newExpressions, options.debug, stark);

    res.nCols = {}; 

    if(stark) {
        console.log("--------------------- POLINOMIALS INFO ---------------------")
        let nColumnsBaseField = 0;
        let nColumns = 0;
        for(let i = 1; i <= res.numChallenges.length + 1; ++i) {
            let stage = i;
            let stageName = "cm" + stage;
            let nCols = res.cmPolsMap.filter(p => p.stage == stageName).length;
            res.nCols[stageName] = nCols;
            let nColsBaseField = res.mapSectionsN[stageName + "_n"];
            if(i === res.numChallenges.length + 1 || (i < res.numChallenges.length && imPolsLastStage)) {
                console.log(`Columns stage ${stage}: ${nCols} -> Columns in the basefield: ${nColsBaseField}`);
            } else {
                console.log(`Columns stage ${stage}: ${nCols} (${res.cmPolsMap.filter(p => p.stage == stageName && p.imPol).length} intermediate columns) -> Columns in the basefield: ${nColsBaseField}`);
            }
            nColumns += nCols;
            nColumnsBaseField += nColsBaseField;
        }
        
        res.nCols["tmpExp"] = res.cmPolsMap.filter(p => p.stage == "tmpExp").length;
        console.log(`Total Columns: ${nColumns} -> Total Columns in the basefield: ${nColumnsBaseField}`);
        console.log(`Total Constraints: ${res.nConstraints}`)
        if(!options.debug) console.log(`Number of evaluations: ${res.evMap.length}`)
        console.log("------------------------------------------------------------")
    }
    
    return res;

}
