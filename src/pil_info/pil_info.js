const {calculateIntermediatePolynomials} = require("./helpers/polynomials/imPolynomials");

const { preparePil } = require("./helpers/preparePil");
const { generatePilCode } = require("./helpers/generatePilCode");

module.exports = function pilInfo(F, pil, stark = true, pil1 = true, starkStruct) {

    const infoPil = preparePil(F, pil, stark, pil1, starkStruct);

    const expressions = infoPil.expressions;
    const symbols = infoPil.symbols;
    const res = infoPil.res;

    let maxDeg;
    if(stark) {
        maxDeg = (1 << (res.starkStruct.nBitsExt- res.starkStruct.nBits)) + 1;
    } else {
        maxDeg = Math.pow(2,3) + 1;
    }
    
    const {newExpressions, qDeg, imExps} = calculateIntermediatePolynomials(expressions, res.cExpId, maxDeg);

    generatePilCode(res, symbols, newExpressions, qDeg, imExps, stark);
    
    return res;

}
