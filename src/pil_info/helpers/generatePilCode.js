const {generateFRIPolynomial} = require("./polynomials/friPolinomial");

const { generateConstraintPolynomialCode, generateConstraintPolynomialVerifierCode, generateFRICode, generateConstraintsDebugCode, generateExpressionsCode, generateStagesCode } = require("./code/generateCode");

module.exports.generatePilCode = function generatePilCode(res, symbols, constraints, expressions, debug, stark) {
    res.code = {};
    res.constraints = {};

    generateStagesCode(res, symbols, expressions, stark);
    
    generateExpressionsCode(res, symbols, expressions, stark);

    if(!debug) {
        generateConstraintPolynomialCode(res, symbols, constraints, expressions, stark);

        generateConstraintPolynomialVerifierCode(res, symbols, expressions, stark);

        if(stark) {
            generateFRIPolynomial(res, symbols, expressions);
            generateFRICode(res, symbols, expressions);
        } 
    }

    generateConstraintsDebugCode(res, symbols, constraints, expressions, stark);

    return res;
}
