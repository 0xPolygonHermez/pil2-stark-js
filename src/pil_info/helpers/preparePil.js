

const { addInfoExpressions } = require("./helpers.js");
const { generatePil1Polynomials } = require("./pil1/generatePil1Polynomials.js");
const { getPiloutInfo } = require("./pil2/piloutInfo.js");
const { generateConstraintPolynomial } = require("./polynomials/constraintPolynomial.js");


module.exports.preparePil = function preparePil(F, pil, stark, pil2, debug, starkStruct) {
    const res = {};

    res.cmPolsMap = [];
    res.constPolsMap = [];

    res.mapSectionsN = {
        "tmpExp_n": 0,
    };

    res.pil2 = true;
    
    res.nCm1 = pil.nCommitments;

    let expressions, symbols, constraints, publicsNames;

    for(let i = 0; i < pil.expressions.length; ++i) {
        pil.expressions[i].stage = 1;
    }
    
    if(pil2) {
        ({expressions, symbols, hints, constraints, publicsNames} = getPiloutInfo(res, pil, stark));
    } else {
        ({expressions, symbols, hints, constraints, publicsNames} = generatePil1Polynomials(F, res, pil, stark));   
    }

    if(stark && !debug) {
        res.starkStruct = starkStruct;
        if (res.starkStruct.nBits != res.pilPower) {
            throw new Error(`starkStruct and pilfile have degree mismatch (airId: ${pil.airId} subproofId: ${pil.subproofId} starkStruct:${res.starkStruct.nBits} pilfile:${res.pilPower})`);
        }

        if (res.starkStruct.nBitsExt != res.starkStruct.steps[0].nBits) {
            throw new Error(`starkStruct.nBitsExt and first step of starkStruct have a mismatch (nBitsExt:${res.starkStruct.nBitsExt} pil:${res.starkStruct.steps[0].nBits})`);
        }
    }

    res.publicsNames = publicsNames;

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
        constraints[i].stage = expressions[constraints[i].e].stage;
    }

    for(let i = 0; i < expressions.length; ++i) {
        if(expressions[i].symbols === undefined) {
            addInfoExpressions(symbols, expressions, expressions[i], stark)
        }
    }
    
    res.hints = hints;

    res.boundaries = [{ name: "everyRow" }];

    if(!debug) {
        generateConstraintPolynomial(res, expressions, constraints, stark);
        addInfoExpressions(symbols, expressions, expressions[res.cExpId], stark);

        res.openingPoints = [... new Set(constraints.reduce((acc, c) => { return acc.concat(expressions[c.e].rowsOffsets)}, [0]))].sort();
    }

    return {res, expressions, constraints, symbols}
}
