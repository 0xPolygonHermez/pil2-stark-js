
const generateConstraintPolynomial = require("./helpers/polynomials/constraintPolynomial");
const generateConstraintPolynomialVerifierCode = require("./helpers/polynomials/constraintPolynomialVerifierCode");

const generateFRIPolynomial = require("./helpers/polynomials/friPolinomial");

const map = require("./map.js");

const { setDimensions, addInfoExpressions } = require("./helpers/helpers.js");
const { generatePil1Polynomials } = require("./helpers/pil1/generatePil1Polynomials");
const { generateConstraintPolynomialCode, generateFRICode, generatePublicsCode, generateStagesCode } = require("./helpers/code/generateCode");
const { getPiloutInfo } = require("./helpers/getPiloutInfo");
const { fixCode } = require("./helpers/code/codegen");

module.exports = function pilInfo(F, pil, stark = true, pil1 = true, starkStruct) {

    const res = {
        cmPolsMap: [],
        challengesMap: [],
        libs: {},
        code: {},
        nLibStages: 0,
        starkStruct: starkStruct,
    };

    let expressions, symbols, constraints, publics;

    if(pil1) {
        ({expressions, symbols, constraints, publics} = generatePil1Polynomials(F, res, pil, stark));
    } else {
        ({expressions, symbols, constraints, publics} = getPiloutInfo(res, pil));
    }

    for(let i = 0; i < constraints.length; ++i) {
        addInfoExpressions(expressions, expressions[constraints[i].e]);
    }
    
    res.openingPoints = [... new Set(constraints.reduce((acc, c) => { return acc.concat(expressions[c.e].rowsOffsets)}, [0]))].sort();

    generateConstraintPolynomial(res, symbols, expressions, constraints, stark);

    map(res, symbols, stark);       

    generatePublicsCode(res, expressions, constraints, publics);

    generateStagesCode(res, expressions, constraints);

    generateConstraintPolynomialCode(res, symbols, expressions, constraints);

    generateConstraintPolynomialVerifierCode(res, symbols, expressions, constraints, stark);

    if(stark) {
        generateFRIPolynomial(res, expressions);
        generateFRICode(res, expressions, constraints);
    } 

    fixCode(res, symbols, stark);

    setDimensions(res, stark);
    
    return res;

}
