const { pilCodeGen, buildCode } = require("./codegen");

module.exports.generatePublicsCode = function generatePublicsCode(res, symbols, expressions, constraints, publics,stark) {
    const ctx = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    for(let i = 0; i < publics.length; ++i) {
        pilCodeGen(ctx, expressions, constraints, publics[i].expId, 0, stark);
        res.publicsCode[i] = buildCode(ctx, res, symbols, expressions, "n", stark);
        res.publicsCode[i].idx = publics[i].idx;
    }
}

module.exports.generateFRICode = function generateFRICode(res, friExpId, symbols, expressions, constraints) {
    const ctxExt = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    pilCodeGen(ctxExt, expressions, constraints, friExpId, 0, true);

    const code = ctxExt.code[ctxExt.code.length-1].code;

    code[code.length-1].dest = { type: "f", id: 0, dim: 3 };

    res.code["fri"] = buildCode(ctxExt, res, symbols, expressions, "ext", true);

    let addMul = res.starkStruct.verificationHashType == "GL" ? false : true;
    pilCodeGen(ctxExt, expressions, constraints, friExpId, 0, true, addMul);
    res.code.queryVerifier = buildCode(ctxExt, res, symbols, expressions, "ext", true, false, true);
}


module.exports.generateConstraintPolynomialCode = function generateConstraintPolynomialCode(res, cExpId, symbols, expressions, constraints, stark) {
    const ctxExt = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    for(let i = 0; i < symbols.length; i++) {
        if(!symbols[i].imPol) continue;
        const expId = symbols[i].expId;
        ctxExt.calculated[expId] = {};
        for(let i = 0; i < res.openingPoints.length; ++i) {
            const openingPoint = res.openingPoints[i];
            ctxExt.calculated[expId][openingPoint] = true;
        }
    }

    pilCodeGen(ctxExt, expressions, constraints, cExpId, 0, stark);
    const code = ctxExt.code[ctxExt.code.length-1].code;
    code[code.length-1].dest = {type: "q", id: 0, dim: res.qDim };

    res.code["Q"] = buildCode(ctxExt, res, symbols, expressions, "ext", stark);
}

module.exports.generateStagesCode = function generateStagesCode(res, symbols, expressions, constraints, stark) {
    const ctx = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    if(res.nLibStages === 0) {
        for(let j = 0; j < expressions.length; ++j) {
            if(expressions[j].stage === 1) {
                pilCodeGen(ctx, expressions, constraints, j, 0, stark);
            }
        }   
        res.code[`stage1`] =  buildCode(ctx, res, symbols, expressions, "n", stark);
    }

    for(let i = 0; i < res.nLibStages; ++i) {
        const stage = 2 + i;
        for(let j = 0; j < expressions.length; ++j) {
            if(expressions[j].stage === stage) {
                pilCodeGen(ctx, expressions, constraints, j, 0, stark);
            }
        }
        res.code[`stage${stage}`] =  buildCode(ctx, res, symbols, expressions, "n", stark);
    }
}
