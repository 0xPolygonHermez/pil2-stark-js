
const generateConstraintPolynomial = require("./helpers/polynomials/constraintPolynomial");

const generateFRIPolynomial = require("./helpers/polynomials/friPolinomial");

const map = require("./map.js");

const { addInfoExpressions } = require("./helpers/helpers.js");
const { generatePil1Polynomials } = require("./helpers/pil1/generatePil1Polynomials");
const { generateConstraintPolynomialCode, generateConstraintPolynomialVerifierCode, generateFRICode, generatePublicsCode, generateStagesCode } = require("./helpers/code/generateCode");
const { getPiloutInfo } = require("./helpers/pil2/piloutInfo");
const { generatePublicsPolynomials } = require("./helpers/pil1/generatePublicsPolynomials");

module.exports = function pilInfo(F, pil, stark = true, pil1 = true, starkStruct) {

    const res = {
        cmPolsMap: [],
        challengesMap: [],
        code: {},
        starkStruct: starkStruct,
    };

    let expressions, symbols, constraints, publicsInfo;

    if(pil1) {
        ({expressions, symbols, hints, constraints, publicsInfo} = generatePil1Polynomials(F, res, pil, stark));
    } else {
        ({expressions, symbols, hints, constraints, publicsInfo} = getPiloutInfo(res, pil, stark));
    }

    let publics = generatePublicsPolynomials(res, expressions, publicsInfo);

    let dimCh = stark ? 3 : 1;
    let qStage = res.numChallenges.length + 1;
    symbols.push({type: "challenge", name: "std_vc", stage: qStage, dim: dimCh, stageId: 0})

    if(stark) {
        symbols.push({type: "challenge", name: "std_xi", stage: qStage + 1, dim: dimCh, stageId: 0})
        symbols.push({type: "challenge", name: "std_vf1", stage: qStage + 2, dim: dimCh, stageId: 0})
        symbols.push({type: "challenge", name: "std_vf2", stage: qStage + 2, dim: dimCh, stageId: 1})
    }

    res.hints = hints;

    for(let i = 0; i < constraints.length; ++i) {
        addInfoExpressions(symbols, expressions, expressions[constraints[i].e], stark);
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
