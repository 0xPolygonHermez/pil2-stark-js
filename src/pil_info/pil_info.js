const {calculateIntermediatePolynomials, addIntermediatePolynomials} = require("./helpers/polynomials/imPolynomials");

const { preparePil } = require("./helpers/preparePil");
const { generatePilCode } = require("./helpers/generatePilCode");
const map = require("./map");

module.exports = function pilInfo(F, pil, stark = true, pil1 = true, debug, starkStruct) {

    const infoPil = preparePil(F, pil, stark, pil1, debug, starkStruct);

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
        const imInfo = calculateIntermediatePolynomials(expressions, res.cExpId, maxDeg);
        addIntermediatePolynomials(res, expressions, symbols, imInfo.imExps, imInfo.qDeg, stark);
        newExpressions = imInfo.newExpressions;
    } else {
        newExpressions = expressions;
    }
    
    map(res, symbols, stark, debug);       

    generatePilCode(res, symbols, constraints, newExpressions, debug, stark);
    
    return res;

}
