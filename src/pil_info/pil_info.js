
const generateConstraintPolynomial = require("./helpers/polynomials/constraintPolynomial");
const generateConstraintPolynomialVerifierCode = require("./helpers/polynomials/constraintPolynomialVerifierCode");

const generateFRIPolynomial = require("./helpers/polynomials/friPolinomial");

const map = require("./map.js");

const { setDimensions, addInfoExpressions } = require("./helpers/helpers.js");
const { generatePil1Polynomials } = require("./helpers/pil1/generatePil1Polynomials");
const { generateConstraintPolynomialCode, generateFRICode, generatePublicsCode, generateLibsCode } = require("./helpers/code/generateCode");
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

    generateConstraintPolynomial(res, expressions, constraints, stark);

    generatePublicsCode(res, expressions, constraints, publics);
    generateLibsCode(res, expressions, constraints);
    generateConstraintPolynomialCode(res, expressions, constraints);

    map(res, symbols, expressions, stark);       

    generateConstraintPolynomialVerifierCode(res, expressions, constraints, stark);

    if(stark) {
        generateFRIPolynomial(res, expressions);
        generateFRICode(res, expressions, constraints);
    } 

    fixCode(res, stark);

    setDimensions(res, stark);

    delete res.imPolsMap;
    delete res.cExp;
    delete res.friExpId;
    
    return res;

}