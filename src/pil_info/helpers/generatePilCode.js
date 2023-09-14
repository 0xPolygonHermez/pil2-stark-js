const generateFRIPolynomial = require("./polynomials/friPolinomial");

const { generateConstraintPolynomialCode, generateConstraintPolynomialVerifierCode, generateFRICode, generatePublicsCode, generateStagesCode } = require("./code/generateCode");

module.exports.generatePilCode = function generatePilCode(res, symbols, constraints, expressions, debug, stark) {
    res.code = {};
    res.constraints = {};

    generatePublicsCode(res, symbols, expressions, stark);

    generateStagesCode(res, symbols, constraints, expressions, stark);

    if(!debug) {
        generateConstraintPolynomialCode(res, symbols, expressions, stark);

        generateConstraintPolynomialVerifierCode(res, symbols, expressions, stark);

        if(stark) {
            const friExp = generateFRIPolynomial(res, symbols, expressions);
            generateFRICode(res, friExp, symbols, expressions);
        } 
    }

    return res;
}