

const { addInfoExpressions } = require("./helpers.js");
const { generatePil1Polynomials } = require("./pil1/generatePil1Polynomials.js");
const { getPiloutInfo } = require("./pil2/piloutInfo.js");
const { generateConstraintPolynomial } = require("./polynomials/constraintPolynomial.js");


module.exports.preparePil = function preparePil(F, pil, starkStruct, stark, pil2, options = {}) {
    const res = {};

    if(starkStruct.verificationHashType === "BN128") {
        res.merkleTreeArity = options.arity || 16;
        res.merkleTreeCustom = options.custom || false;
    }

    res.isVadcop = options.vadcop || false;
    res.hashCommits = options.hashCommits || false;

    res.cmPolsMap = [];
    res.constPolsMap = [];

    res.mapSectionsN = {
        "const_n": 0,
        "const_ext": 0,
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

    for(let s = 1; s <= res.numChallenges.length; s++) {
        res.mapSectionsN["cm" + s + "_n"] = 0;
        res.mapSectionsN["cm" + s + "_ext"] = 0;
    }

    if(stark && !options.debug) {
        res.starkStruct = starkStruct;
        if (res.starkStruct.nBits != res.pilPower) {
            throw new Error(`starkStruct and pilfile have degree mismatch (airId: ${pil.airId} subproofId: ${pil.subproofId} starkStruct:${res.starkStruct.nBits} pilfile:${res.pilPower})`);
        }

        if (res.starkStruct.nBitsExt != res.starkStruct.steps[0].nBits) {
            throw new Error(`starkStruct.nBitsExt and first step of starkStruct have a mismatch (nBitsExt:${res.starkStruct.nBitsExt} pil:${res.starkStruct.steps[0].nBits})`);
        }
    }

    res.publicsNames = publicsNames;

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

    res.openingPoints = [... new Set(constraints.reduce((acc, c) => { return acc.concat(expressions[c.e].rowsOffsets)}, [0]))].sort();

    if(!options.debug) {
        generateConstraintPolynomial(res, expressions, symbols, constraints, stark);
    }

    return {res, expressions, constraints, symbols}
}
