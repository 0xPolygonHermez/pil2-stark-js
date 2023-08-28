const { log2 } = require("pilcom/src/utils");
const generateLibsCode = require("./generateLibsCode");
const generatePublicsCode = require("./generatePublicsCode");

module.exports.generatePil1Code = function generatePil1Code(F, res, _pil, stark) {
    const pil = JSON.parse(JSON.stringify(_pil));    // Make a copy as we are going to destroy the original

    res.nPublics = pil.publics.length;
    res.nConstants = pil.nConstants;

    const ctx = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    generatePublicsCode(res, pil, ctx);

    generateLibsCode(F, res, pil, ctx, stark);

    res.nCommitments = pil.nCommitments;
    res.pilPower = log2(Object.values(pil.references)[0].polDeg);

    const expressions = [...pil.expressions];
    const constraints = [...pil.polIdentities]

    const symbols = [];

    for (const polRef in pil.references) {
        const polInfo = pil.references[polRef];
        if(polInfo.type === "imP") continue;
        const type = polInfo.type === 'constP' ? "fixed" : "witness";
        let name = polRef;
        if(polInfo.isArray) {
            for(let i = 0; i < polInfo.len; ++i) {
                const namePol = name + i;
                const polId = polInfo.id + i;
                symbols.push({type, name: namePol, polId});
            }
        } else {
            symbols.push({type, name, polId: polInfo.id});
        }
    }

    for(let i = 0; i < constraints.length; i++) {
        if(!constraints[i].boundary) {
            constraints[i].boundary = "everyRow";
        }   
    }

    if(stark) {
        if (res.starkStruct.nBits != res.pilPower) {
            throw new Error(`starkStruct and pilfile have degree mismatch (starkStruct:${res.starkStruct.nBits} pilfile:${res.pilPower})`);
        }

        if (res.starkStruct.nBitsExt != res.starkStruct.steps[0].nBits) {
            throw new Error(`starkStruct.nBitsExt and first step of starkStruct have a mismatch (nBitsExt:${res.starkStruct.nBitsExt} pil:${res.starkStruct.steps[0].nBits})`);
        }
    }

    return { symbols, expressions, constraints };
}