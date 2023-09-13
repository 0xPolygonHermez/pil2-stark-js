

const { addInfoExpressions } = require("./helpers.js");
const { generatePil1Polynomials } = require("./pil1/generatePil1Polynomials.js");
const { getPiloutInfo } = require("./pil2/piloutInfo.js");
const { generateConstraintPolynomial } = require("./polynomials/constraintPolynomial.js");
const { generatePublicsPolynomials } = require("./polynomials/publicsPolynomials.js");


module.exports.preparePil = function preparePil(F, pil, stark, pil1, starkStruct) {
    const res = {
        cmPolsMap: [],
        code: {},
        starkStruct: starkStruct,
    };

    let expressions, symbols, constraints, publicsInfo;

    if(pil1) {
        ({expressions, symbols, hints, constraints, publicsInfo} = generatePil1Polynomials(F, res, pil, stark));
    } else {
        ({expressions, symbols, hints, constraints, publicsInfo} = getPiloutInfo(res, pil, stark));
    }

    res.publics = generatePublicsPolynomials(expressions, publicsInfo);

    let dimCh = stark ? 3 : 1;
    let qStage = res.numChallenges.length + 1;
    symbols.push({type: "challenge", name: "std_vc", stage: qStage, dim: dimCh, stageId: 0})

    if(stark) {
        symbols.push({type: "challenge", name: "std_xi", stage: qStage + 1, dim: dimCh, stageId: 0})
        symbols.push({type: "challenge", name: "std_vf1", stage: qStage + 2, dim: dimCh, stageId: 0})
        symbols.push({type: "challenge", name: "std_vf2", stage: qStage + 2, dim: dimCh, stageId: 1})
    }

    for(let i = 0; i < constraints.length; ++i) {
        addInfoExpressions(symbols, expressions, expressions[constraints[i].e], stark);
    }
        
    generateConstraintPolynomial(res, expressions, constraints, stark);

    res.hints = hints;

    res.openingPoints = [... new Set(constraints.reduce((acc, c) => { return acc.concat(expressions[c.e].rowsOffsets)}, [0]))].sort();

    return {res, expressions, symbols}
}