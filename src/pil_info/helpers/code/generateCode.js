const { getExpDim } = require("../helpers");
const { pilCodeGen, buildCode } = require("./codegen");

module.exports.generateHintsCode = function generateHintsCode(res, symbols, expressions, stark) {
    for(let i = 0; i < res.hints.length; ++i) {
        const hint = res.hints[i];
        for(let j = 0; j < Object.keys(hint).length; ++j) {
            const ctx = {
                calculated: {},
                tmpUsed: 0,
                code: [],
                expMap: [],
                dom: "n",
                airId: res.airId,
                subproofId: res.subproofId,
                stark,
            };
            if(hint.name === "public") ctx.publics = true;
            const key = Object.keys(hint)[j];
            if(hint[key].op === "exp") {
                pilCodeGen(ctx, symbols, expressions, hint[key].id, 0);
                if(!hint.code) hint.code = {};
                hint.code[key] = buildCode(ctx, expressions);
            }
        }
    }
}

module.exports.generateStagesCode = function generateStagesCode(res, symbols, constraints, expressions, stark) {
    const ctx = {
        calculated: {},
        tmpUsed: 0,
        code: [],
        expMap: [],
        dom: "n",
        airId: res.airId,
        subproofId: res.subproofId,
        stark,
    };

    const nStages = res.numChallenges.length;

    for(let j = 0; j < expressions.length; ++j) {
        if(expressions[j].stage === 1 && symbols.find(s => s.stage === 1 && s.expId === j && s.airId === res.airId && s.subproofId === res.subproofId)) {
            pilCodeGen(ctx, symbols, expressions, j, 0);
        }
    }   
    res.code[`stage1`] =  buildCode(ctx, expressions);
    

    for(let i = 0; i < nStages - 1; ++i) {
        const stage = 2 + i;
        for(let j = 0; j < expressions.length; ++j) {
            if(expressions[j].stage === stage) {
                if(stage === nStages && expressions[j].symbols.filter(s => s.op === "cm" && s.stage === stage).length !== 0) continue;
                pilCodeGen(ctx, symbols, expressions, j, 0);
            }
        }
        res.code[`stage${stage}`] =  buildCode(ctx, expressions);
    }

    for(let j = 0; j < expressions.length; ++j) {
        if(expressions[j].stage === nStages && expressions[j].symbols.filter(s => s.op === "cm" && s.stage === nStages).length !== 0) {
            pilCodeGen(ctx, symbols, expressions, j, 0);
        }
    }
    res.code["imPols"] = buildCode(ctx, expressions);

    for(let i = 0; i < nStages; ++i) {
        const stage = i + 1;
        const stageConstraints = constraints.filter(c => c.stage === stage);
        res.constraints[`stage${stage}`] = [];
        for(let j = 0; j < stageConstraints.length; ++j) {
            pilCodeGen(ctx, symbols, expressions, stageConstraints[j].e, 0, true);
            const constraint = buildCode(ctx, expressions);
            constraint.boundary = stageConstraints[j].boundary;
            constraint.line = stageConstraints[j].line;
            constraint.filename = stageConstraints[j].fileName;
            if(stageConstraints[j].boundary === "everyFrame") {
                constraint.offsetMin = stageConstraints[j].offsetMin;
                constraint.offsetMax = stageConstraints[j].offsetMax;
            }
            res.constraints[`stage${stage}`][j] = constraint;
        }
    }
}


module.exports.generateConstraintPolynomialCode = function generateConstraintPolynomialCode(res, symbols, constraints, expressions, stark) {
    const ctxExt = {
        calculated: {},
        tmpUsed: 0,
        code: [],
        expMap: [],
        dom: "ext",
        airId: res.airId,
        subproofId: res.subproofId,
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

    pilCodeGen(ctxExt, symbols, expressions, res.cExpId, 0);
    if(stark) {
        let multipleBoundaries = false;
        if(constraints.filter(c => c.boundary !== "everyRow").length > 0) multipleBoundaries = true;
        if(!multipleBoundaries) {
            const code = ctxExt.code;
            code.push({
                op: "mul",
                dest: {
                    type: "q",
                    id: 0,
                    dim: res.qDim,
                },
                src: [
                    code[code.length-1].dest,
                    { type: "Zi", boundaryId: 0, dim: res.qDim }
                ]
            });
        }
    } else {
        const code = ctxExt.code;
        code.push({
            op: "copy",
            dest: {
                type: "q",
                id: 0
            },
            src: [code[code.length-1].dest],
        });
    }
    
    res.code[`stage${qStage}`] = buildCode(ctxExt, expressions);
    res.code[`stage${qStage}`].code[res.code[`stage${qStage}`].code.length-1].dest = { type: "q", id: 0, dim: res.qDim };
}

module.exports.generateConstraintPolynomialVerifierCode = function generateConstraintPolynomialVerifierCode(res, symbols, expressions, stark) {       
    let addMul = stark ? false : true;

    let ctx = {
        calculated: {},
        tmpUsed: 0,
        code: [],
        evMap: [],
        expMap: [],
        dom: "n",
        airId: res.airId,
        subproofId: res.subproofId,
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

    pilCodeGen(ctx, symbols, expressions, res.cExpId, 0);
    res.code.qVerifier = buildCode(ctx, expressions);

    res.evMap = ctx.evMap;

    if (stark) {
        for (let i = 0; i < res.qDeg; i++) {
            const rf = { type: "cm", id: res.qs[i], name: "Q" + i, prime: 0, dim: res.qDim, stage: "Q", airId: res.airId, subproofId: res.subproofId };
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


module.exports.generateFRICode = function generateFRICode(res, friExp, symbols, expressions) {
    const ctxExt = {
        calculated: {},
        tmpUsed: 0,
        code: [],
        expMap: [],
        dom: "ext",
        airId: res.airId,
        subproofId: res.subproofId,
        stark: true,
    };

    let friExpId = expressions.length;
    expressions.push(friExp);
    expressions[friExpId].dim = getExpDim(expressions, friExpId, true);

    pilCodeGen(ctxExt, symbols, expressions, friExpId, 0);
    res.code.fri = buildCode(ctxExt, expressions);
    res.code.fri.code[res.code.fri.code.length-1].dest = { type: "f", id: 0, dim: 3 };

    let addMul = false;

    ctxExt.verifierQuery = true;
    ctxExt.addMul = addMul;
    pilCodeGen(ctxExt, symbols, expressions, friExpId, 0);
    res.code.queryVerifier = buildCode(ctxExt, expressions);
}
