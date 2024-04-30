

const { addInfoExpressions } = require("./helpers.js");
const { generatePil1Polynomials } = require("./pil1/generatePil1Polynomials.js");
const { getPiloutInfo } = require("./pil2/piloutInfo.js");
const { generateConstraintPolynomial } = require("./polynomials/constraintPolynomial.js");


module.exports.preparePil = function preparePil(F, pil, starkStruct, stark, pil2, options = {}) {
    const res = {};

    res.imPolsStages = options.imPolsStages || false;

    res.cmPolsMap = [];
    res.constPolsMap = [];
    res.challengesMap = [];
    res.pil2 = pil2;

    res.mapSectionsN = {
        "const": 0,
        "tmpExp": 0,
    };
    
    let expressions, symbols, constraints;

    for(let i = 0; i < pil.expressions.length; ++i) {
        pil.expressions[i].stage = 1;
    }
    
    if(pil2) {
        ({expressions, symbols, hints, constraints} = getPiloutInfo(res, pil, stark));
    } else {
        ({expressions, symbols, hints, constraints} = generatePil1Polynomials(F, res, pil, stark, options));   
    }

    for(let s = 1; s <= res.nStages + 1; s++) {
        res.mapSectionsN["cm" + s] = 0;
    }

    if(stark) {
        if(!options.debug) {
            res.starkStruct = starkStruct;
            if (res.starkStruct.nBits != res.pilPower) {
                throw new Error(`starkStruct and pilfile have degree mismatch (airId: ${pil.airId} subproofId: ${pil.subproofId} starkStruct:${res.starkStruct.nBits} pilfile:${res.pilPower})`);
            }

            if (res.starkStruct.nBitsExt != res.starkStruct.steps[0].nBits) {
                throw new Error(`starkStruct.nBitsExt and first step of starkStruct have a mismatch (nBitsExt:${res.starkStruct.nBitsExt} pil:${res.starkStruct.steps[0].nBits})`);
            }
        } else {
            res.starkStruct = { nBits: res.pilPower };
        }
    }

    for(let i = 0; i < constraints.length; ++i) {
        addInfoExpressions(expressions, expressions[constraints[i].e], stark);
        constraints[i].stage = expressions[constraints[i].e].stage;
    }

    for(let i = 0; i < expressions.length; ++i) {
        if(expressions[i].symbols === undefined) {
            addInfoExpressions(expressions, expressions[i], stark)
        }
    }
    
    res.boundaries = [{ name: "everyRow" }];

    res.openingPoints = [... new Set(constraints.reduce((acc, c) => { return acc.concat(expressions[c.e].rowsOffsets)}, [0]))].sort();

    generateConstraintPolynomial(res, expressions, symbols, constraints, stark);
    
    return {res, expressions, constraints, symbols, hints}
}