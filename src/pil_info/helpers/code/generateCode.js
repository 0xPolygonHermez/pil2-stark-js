const { pilCodeGen, buildCode } = require("./codegen");

module.exports.generatePublicsCode = function generatePublicsCode(res, symbols, expressions, constraints, publics,stark) {
    const ctx = {
        calculated: {},
        tmpUsed: 0,
        code: [],
        expMap: [],
        dom: "n",
        stark,
        publics: true,
    };

    for(let i = 0; i < publics.length; ++i) {
        pilCodeGen(ctx, symbols, expressions, constraints, publics[i].expId, 0);
        res.publicsCode[i] = buildCode(ctx, expressions);
        res.publicsCode[i].idx = publics[i].idx;
    }
}

module.exports.generateStagesCode = function generateStagesCode(res, symbols, expressions, constraints, stark) {
    const ctx = {
        calculated: {},
        tmpUsed: 0,
        code: [],
        expMap: [],
        dom: "n",
        stark,
    };

    for(let j = 0; j < expressions.length; ++j) {
        if(expressions[j].stage === 1 && symbols.find(s => s.stage === 1 && s.expId === j)) {
            pilCodeGen(ctx, symbols, expressions, constraints, j, 0);
        }
    }   
    res.code[`stage1`] =  buildCode(ctx, expressions);
    

    for(let i = 0; i < res.numChallenges.length - 1; ++i) {
        const stage = 2 + i;
        for(let j = 0; j < expressions.length; ++j) {
            if(expressions[j].stage === stage) {
                pilCodeGen(ctx, symbols, expressions, constraints, j, 0);
            }
        }
        res.code[`stage${stage}`] =  buildCode(ctx, expressions);
    }
}


module.exports.generateConstraintPolynomialCode = function generateConstraintPolynomialCode(res, cExpId, symbols, expressions, constraints, stark) {
    const ctxExt = {
        calculated: {},
        tmpUsed: 0,
        code: [],
        expMap: [],
        dom: "ext",
        stark,
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

    const qStage = res.numChallenges.length + 1;

    pilCodeGen(ctxExt, symbols, expressions, constraints, cExpId, 0);
    res.code[`stage${qStage}`] = buildCode(ctxExt, expressions);
    res.code[`stage${qStage}`].code[res.code[`stage${qStage}`].code.length-1].dest = { type: "q", id: 0, dim: res.qDim };
}

module.exports.generateConstraintPolynomialVerifierCode = function generateConstraintPolynomialVerifierCode(res, cExpId, symbols, expressions, constraints, stark) {       
    let addMul = stark && res.starkStruct.verificationHashType == "GL" ? false : true;

    let ctx = {
        calculated: {},
        tmpUsed: 0,
        code: [],
        evMap: [],
        expMap: [],
        dom: "n",
        stark,
        addMul,
        verifierEvaluations: true,
    };

    for(let i = 0; i < symbols.length; i++) {
        if(!symbols[i].imPol) continue;
        const expId = symbols[i].expId;
        ctx.calculated[expId] = {};
        for(let i = 0; i < res.openingPoints.length; ++i) {
            const openingPoint = res.openingPoints[i];
            ctx.calculated[expId][openingPoint] = true;
        }
    }

    pilCodeGen(ctx, symbols, expressions, constraints, cExpId, 0);
    res.code.qVerifier = buildCode(ctx, expressions);

    res.evMap = ctx.evMap;

    if (stark) {
        for (let i = 0; i < res.qDeg; i++) {
            const rf = { type: "cm", id: res.qs[i], name: "Q" + i, prime: 0, dim: res.qDim, stage: res.numChallenges.length + 1 };
            res.evMap.push(rf);
        }
    } else {
        let nOpenings = {};
        for(let i = 0; i < res.evMap.length; ++i) {
            if(res.evMap[i].type === "const") continue;
            const name = res.evMap[i].type + res.evMap[i].id;
            if(!nOpenings[name]) nOpenings[name] = 1;
            ++nOpenings[name];
        }   

        res.maxPolsOpenings = Math.max(...Object.values(nOpenings));

        res.nBitsZK = Math.ceil(Math.log2((res.pilPower + res.maxPolsOpenings) / res.pilPower));
    }
}


module.exports.generateFRICode = function generateFRICode(res, friExpId, symbols, expressions, constraints) {
    const ctxExt = {
        calculated: {},
        tmpUsed: 0,
        code: [],
        expMap: [],
        dom: "ext",
        stark: true,
    };

    pilCodeGen(ctxExt, symbols, expressions, constraints, friExpId, 0);
    res.code.fri = buildCode(ctxExt, expressions);
    res.code.fri.code[res.code.fri.code.length-1].dest = { type: "f", id: 0, dim: 3 };

    let addMul = res.starkStruct.verificationHashType == "GL" ? false : true;

    ctxExt.verifierQuery = true;
    ctxExt.addMul = addMul;
    pilCodeGen(ctxExt, symbols, expressions, constraints, friExpId, 0);
    res.code.queryVerifier = buildCode(ctxExt, expressions);
}
