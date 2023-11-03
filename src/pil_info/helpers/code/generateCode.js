const { getExpDim } = require("../helpers");
const { pilCodeGen, buildCode } = require("./codegen");

module.exports.generateExpressionsCode = function generateExpressionsCode(res, symbols, expressions, stark) {
    const expressionsCode = [];

    const calculatedExps = [];

    for(let j = 0; j < expressions.length; ++j) {
        const exp = expressions[j];
        if(j === res.cExpId || j === res.friExpId) continue;
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

        const tmpExpressionsIds = expressionsCode.filter(e => (e.stage < exp.stage || calculatedExps.includes[e.expId]) && e.dest).map(e => e.expId);
        for(let i = 0; i < tmpExpressionsIds.length; i++) {
            const expId = tmpExpressionsIds;
            ctx.calculated[expId] = {};
            for(let j = 0; j < res.openingPoints.length; ++j) {
                const openingPoint = res.openingPoints[j];
                ctx.calculated[expId][openingPoint] = true;
            }
        }
        
        pilCodeGen(ctx, symbols, expressions, j, 0);
        const code = buildCode(ctx, expressions);
        const expInfo = {
            expId: j,
            stage: exp.stage,
            symbols: exp.symbols,
            code,
        }

        if(code.code.length > 0 && code.code[code.code.length - 1].dest.type !== "tmp") {
            const symbol = symbols.find( s => ["witness", "tmpPol"].includes(s.type) && s.polId === code.code[code.code.length - 1].dest.id);
            expInfo.dest = {op: "cm", stage: symbol.stage, stageId: symbol.stageId};
            calculatedExps.push(expInfo.expId);
        }
        expressionsCode.push(expInfo);
    }

    res.expressionsCode = expressionsCode;
}

module.exports.generateConstraintsDebugCode = function generateConstraintsDebugCode(res, symbols, constraints, expressions, stark) {
    for(let i = 0; i < res.numChallenges.length; ++i) {
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
                { type: "Zi", boundary: "everyRow", dim: res.qDim }
            ]
        });
    }
    res.code.qCode = buildCode(ctxExt, expressions);
    res.code.qCode.code[res.code.qCode.code.length-1].dest = { type: "q", id: 0, dim: res.qDim };
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
