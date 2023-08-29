const { pilCodeGen, buildCode } = require("./codegen");

module.exports.generatePublicsCode = function generatePublicsCode(res, expressions, constraints, publics) {
    const ctx = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    for(let i = 0; i < publics.length; ++i) {
        pilCodeGen(ctx, expressions, constraints, publics[i].expId, 0);
        res.publicsCode[i] = buildCode(ctx, expressions);
        res.publicsCode[i].idx = publics[i].idx;
    }
}

module.exports.generateFRICode = function generateFRICode(res, expressions, constraints) {
    const ctxExt = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    pilCodeGen(ctxExt, expressions, constraints, res.friExpId, 0);

    const code = ctxExt.code[ctxExt.code.length-1].code;

    code[code.length-1].dest = { type: "f", id: 0 };

    res.code["fri"] = buildCode(ctxExt, expressions);

    let addMul = res.starkStruct.verificationHashType == "GL" ? false : true;
    pilCodeGen(ctxExt, expressions, constraints, res.friExpId, 0, addMul);
    res.code.queryVerifier = buildCode(ctxExt, expressions);
}


module.exports.generateConstraintPolynomialCode = function generateConstraintPolynomialCode(res, expressions, constraints) {
    const ctx_ext = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    for(let i = 0; i < Object.keys(res.imPolsMap).length; i++) {
        const expId = Object.keys(res.imPolsMap)[i];
        ctx_ext.calculated[expId] = {};
        for(let i = 0; i < res.openingPoints.length; ++i) {
            const openingPoint = res.openingPoints[i];
            ctx_ext.calculated[expId][openingPoint] = true;
        }
    }

    pilCodeGen(ctx_ext, expressions, constraints, res.cExp, 0);
    const code = ctx_ext.code[ctx_ext.code.length-1].code;
    code[code.length-1].dest = {type: "q", id: 0};

    res.code["Q"] = buildCode(ctx_ext, expressions);
}

module.exports.generateLibsCode = function generateLibsCode(res, expressions, constraints) {
    const ctx = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    if(res.nLibStages === 0) {
        for(let j = 0; j < expressions.length; ++j) {
            if(expressions[j].stage === 1) {
                pilCodeGen(ctx, expressions, constraints, j, 0);
            }
        }   
        res.code[`stage1`] = buildCode(ctx, expressions);
    }

    for(let i = 0; i < res.nLibStages; ++i) {
        const stage = 2 + i;
        for(let j = 0; j < expressions.length; ++j) {
            if(expressions[j].stage === stage) {
                pilCodeGen(ctx, expressions, constraints, j, 0);
            }
        }
        res.code[`stage${stage}`] = buildCode(ctx, expressions);
    }
}