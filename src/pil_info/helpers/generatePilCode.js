const {generateFRIPolynomial} = require("./polynomials/friPolinomial");

const { generateConstraintPolynomialCode, generateConstraintPolynomialVerifierCode, generateFRICode, generateConstraintsDebugCode, generateExpressionsCode, generateStagesCode } = require("./code/generateCode");
const { addInfoExpressionsSymbols } = require("./helpers");

module.exports.generatePilCode = function generatePilCode(res, symbols, constraints, expressions, debug, stark) {
    res.code = {};
    res.constraints = {};

    for(let i = 0; i < expressions.length; i++) {
        addInfoExpressionsSymbols(symbols, expressions, expressions[i], stark);
    }

    generateStagesCode(res, symbols, expressions, stark);
    
    generateExpressionsCode(res, symbols, expressions, stark);

    if(!debug) {
        generateConstraintPolynomialCode(res, symbols, constraints, expressions, stark);

        generateConstraintPolynomialVerifierCode(res, symbols, expressions, stark);

        if(stark) {
            generateFRIPolynomial(res, symbols, expressions);
            addInfoExpressionsSymbols(symbols, expressions, expressions[res.friExpId], stark);
            generateFRICode(res, symbols, expressions);
        } 
    }

    generateConstraintsDebugCode(res, symbols, constraints, expressions, stark);

    return res;
}
