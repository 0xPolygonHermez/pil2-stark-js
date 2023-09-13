const generateFRIPolynomial = require("./polynomials/friPolinomial");

const {addIntermediatePolynomials} = require("./polynomials/imPolynomials");

const map = require("../map.js");

const { generateConstraintPolynomialCode, generateConstraintPolynomialVerifierCode, generateFRICode, generatePublicsCode, generateStagesCode } = require("./code/generateCode");

module.exports.generatePilCode = function generatePilCode(res, symbols, expressions, qDeg, imExps, stark) {
    addIntermediatePolynomials(res, expressions, symbols, imExps, qDeg, stark);

    map(res, symbols, stark);       

    generatePublicsCode(res, symbols, expressions, stark);

    generateStagesCode(res, symbols, expressions, stark);

    generateConstraintPolynomialCode(res, symbols, expressions, stark);

    generateConstraintPolynomialVerifierCode(res, symbols, expressions, stark);

    if(stark) {
        const friExp = generateFRIPolynomial(res, symbols, expressions);
        generateFRICode(res, friExp, symbols, expressions);
    } 

    return res;
}