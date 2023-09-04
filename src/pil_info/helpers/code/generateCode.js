const { setCodeDimensions } = require("../helpers");
const { pilCodeGen, buildCode, fixProverCode } = require("./codegen");

module.exports.generatePublicsCode = function generatePublicsCode(res, symbols, expressions, constraints, publics,stark) {
    const ctx = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    for(let i = 0; i < publics.length; ++i) {
        pilCodeGen(ctx, expressions, constraints, publics[i].expId, 0);
        res.publicsCode[i] = buildCode(ctx, expressions);
        res.publicsCode[i].idx = publics[i].idx;
        fixProverCode(res, symbols, res.publicsCode[i], "n", stark, false, false);
        setCodeDimensions(res.publicsCode[i], res, stark);
    }
}

module.exports.generateFRICode = function generateFRICode(res, friExpId, symbols, expressions, constraints, stark) {
    const ctxExt = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    pilCodeGen(ctxExt, expressions, constraints, friExpId, 0);

    const code = ctxExt.code[ctxExt.code.length-1].code;

    code[code.length-1].dest = { type: "f", id: 0, dim: 3 };

    res.code["fri"] = buildCode(ctxExt, expressions);
    fixProverCode(res, symbols, res.code.fri, "ext", stark, false, false);
    setCodeDimensions(res.code.fri, res, stark);

    let addMul = res.starkStruct.verificationHashType == "GL" ? false : true;
    pilCodeGen(ctxExt, expressions, constraints, friExpId, 0, addMul);
    res.code.queryVerifier = buildCode(ctxExt, expressions);
    fixProverCode(res, symbols, res.code.queryVerifier, "ext", stark, false, true);
    setCodeDimensions(res.code.queryVerifier, res, stark);
}


module.exports.generateConstraintPolynomialCode = function generateConstraintPolynomialCode(res, cExpId, symbols, expressions, constraints, stark) {
    const ctx_ext = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    for(let i = 0; i < symbols.length; i++) {
        if(!symbols[i].imPol) continue;
        const expId = symbols[i].expId;
        ctx_ext.calculated[expId] = {};
        for(let i = 0; i < res.openingPoints.length; ++i) {
            const openingPoint = res.openingPoints[i];
            ctx_ext.calculated[expId][openingPoint] = true;
        }
    }

    pilCodeGen(ctx_ext, expressions, constraints, cExpId, 0);
    const code = ctx_ext.code[ctx_ext.code.length-1].code;
    code[code.length-1].dest = {type: "q", id: 0, dim: res.qDim };

    res.code["Q"] = buildCode(ctx_ext, expressions);
    fixProverCode(res, symbols, res.code["Q"], "ext", stark, false, false);
    setCodeDimensions(res.code.Q, res, stark);
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
                pilCodeGen(ctx, expressions, constraints, j, 0);
            }
        }   
        res.code[`stage1`] = buildCode(ctx, expressions);
        fixProverCode(res, symbols, res.code["stage1"], "n", stark, false, false);
        setCodeDimensions(res.code.stage1, res, stark);
    }

    for(let i = 0; i < res.nLibStages; ++i) {
        const stage = 2 + i;
        for(let j = 0; j < expressions.length; ++j) {
            if(expressions[j].stage === stage) {
                pilCodeGen(ctx, expressions, constraints, j, 0);
            }
        }
        res.code[`stage${stage}`] = buildCode(ctx, expressions);
        fixProverCode(res, symbols, res.code[`stage${stage}`], "n", stark, false, false);
        setCodeDimensions(res.code[`stage${stage}`], res, stark);
    }
}
