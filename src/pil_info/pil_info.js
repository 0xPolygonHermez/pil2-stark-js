
const generateConstraintPolynomial = require("./helpers/polynomials/constraintPolynomial");

const generateFRIPolynomial = require("./helpers/polynomials/friPolinomial");

const map = require("./map.js");

const { addInfoExpressions } = require("./helpers/helpers.js");
const { generatePil1Polynomials } = require("./helpers/pil1/generatePil1Polynomials");
const { generateConstraintPolynomialCode, generateConstraintPolynomialVerifierCode, generateFRICode, generatePublicsCode, generateStagesCode } = require("./helpers/code/generateCode");
const { getPiloutInfo } = require("./helpers/getPiloutInfo");

module.exports = function pilInfo(F, pil, stark = true, pil1 = true, starkStruct) {

    const res = {
        cmPolsMap: [],
        challengesMap: [],
        code: {},
        nLibStages: 0,
        starkStruct: starkStruct,
    };

    let expressions, symbols, constraints, publics;

    if(pil1) {
        ({expressions, symbols, hints, constraints, publics} = generatePil1Polynomials(F, res, pil, stark));
    } else {
        ({expressions, symbols, hints, constraints, publics} = getPiloutInfo(res, pil));
    }

    symbols.push({type: "challenge", name: "std_vc", stage: res.nLibStages + 2, dim: stark ? 3 : 1, stageId: 0})

    if(stark) {
        symbols.push({type: "challenge", name: "std_xi", stage: res.nLibStages + 3, dim: stark ? 3 : 1, stageId: 0})
        symbols.push({type: "challenge", name: "std_vf1", stage: res.nLibStages + 4, dim: stark ? 3 : 1, stageId: 0})
        symbols.push({type: "challenge", name: "std_vf2", stage: res.nLibStages + 4, dim: stark ? 3 : 1, stageId: 1})
    }

    res.hints = hints;

    for(let i = 0; i < constraints.length; ++i) {
        addInfoExpressions(expressions, expressions[constraints[i].e], stark);
    }
    
    res.openingPoints = [... new Set(constraints.reduce((acc, c) => { return acc.concat(expressions[c.e].rowsOffsets)}, [0]))].sort();
        
    const cExpId = generateConstraintPolynomial(res, symbols, expressions, constraints, stark);

    map(res, symbols, stark);       

    generatePublicsCode(res, symbols, expressions, constraints, publics, stark);

    generateStagesCode(res, symbols, expressions, constraints, stark);

    generateConstraintPolynomialCode(res, cExpId, symbols, expressions, constraints, stark);

    generateConstraintPolynomialVerifierCode(res, cExpId, symbols, expressions, constraints, stark);

    if(stark) {
        const friExpId = generateFRIPolynomial(res, symbols, expressions);
        generateFRICode(res, friExpId, symbols, expressions, constraints);
    } 
    
    return res;

}
