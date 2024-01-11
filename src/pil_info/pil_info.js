const {calculateIntermediatePolynomials, addIntermediatePolynomials} = require("./helpers/polynomials/imPolynomials");

const { preparePil } = require("./helpers/preparePil");
const { generatePilCode } = require("./helpers/generatePilCode");
const map = require("./map");

module.exports = function pilInfo(F, pil, stark = true, pil2 = true, debug, starkStruct, imPolsLastStage = true) {

    const infoPil = preparePil(F, pil, stark, pil2, debug, starkStruct);

    const expressions = infoPil.expressions;
    const constraints = infoPil.constraints;
    const symbols = infoPil.symbols;
    const res = infoPil.res;
 
    let newExpressions;
    if(!debug) {
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
    
    map(res, symbols, stark, debug);       

    generatePilCode(res, symbols, constraints, newExpressions, debug, stark);

    if(!debug) {
        console.log("--------------------- POLINOMIALS INFO ---------------------")
        let nColumnsBaseField = 0;
        let nColumns = 0;
        for(let i = 1; i <= res.numChallenges.length + 1; ++i) {
            let stage = i === res.numChallenges.length + 1 ? "Q": i;
            let nCols = res.cmPolsMap.filter(p => p.stage == "cm" + stage).length;
            let nColsBaseField = res.mapSectionsN["cm" + stage];
            if(i === res.numChallenges.length + 1 || (i < res.numChallenges.length && imPolsLastStage)) {
                console.log(`Columns stage ${stage}: ${nCols} -> Columns in the basefield: ${nColsBaseField}`);
            } else {
                console.log(`Columns stage ${stage}: ${nCols} (${res.cmPolsMap.filter(p => p.stage == "cm" + stage && p.imPol).length} intermediate columns) -> Columns in the basefield: ${nColsBaseField}`);
            }
            nColumns += nCols;
            nColumnsBaseField += nColsBaseField;
        }
        console.log(`Total Columns: ${nColumns} -> Total Columns in the basefield: ${nColumnsBaseField}`);
        console.log(`Total Constraints: ${res.nConstraints}`)
        console.log(`Number of evaluations: ${res.evMap.length}`)
        console.log("------------------------------------------------------------")
    }
    
    return res;

}
