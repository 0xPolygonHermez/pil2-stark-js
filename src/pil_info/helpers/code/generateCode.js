const { pilCodeGen, buildCode } = require("./codegen");

module.exports.generateExpressionsCode = function generateExpressionsCode(res, symbols, expressions, stark) {
    const expressionsCode = [];

    for(let j = 0; j < expressions.length; ++j) {
        const exp = expressions[j];
        if(j === res.cExpId || j === res.friExpId) continue;
        if(!exp.keep && !exp.imPol) continue;
        const ctx = {
            calculated: {},
            symbolsCalculated: [],
            symbolsUsed: [],
            tmpUsed: 0,
            code: [],
            dom: "n",
            airId: res.airId,
            subproofId: res.subproofId,
            stark,
        };

        const tmpExpressionsIds = expressionsCode.filter(e => (e.stage < exp.stage) && e.dest).map(e => e.expId);

        for(let i = 0; i < tmpExpressionsIds.length; i++) {
            const expId = tmpExpressionsIds[i];
            ctx.calculated[expId] = {};
            for(let j = 0; j < res.openingPoints.length; ++j) {
                const openingPoint = res.openingPoints[j];
                ctx.calculated[expId][openingPoint] = true;
            }
        }
        
        let exprDest;
        const symbolDest = symbols.find(s => s.expId === j);
        if(symbolDest.type === "witness" || (symbolDest.type === "tmpPol" && symbolDest.imPol)) {
            exprDest = { op: "cm", stage: symbolDest.stage, stageId: symbolDest.stageId, id: symbolDest.polId};
        } else {
            exprDest = { op: "tmp", stage: symbolDest.stage, stageId: symbolDest.stageId, id: symbolDest.polId };
        }
        ctx.symbolsCalculated.push(exprDest);

        for(let k = 0; k < exp.symbols.length; k++) {
            const symbolUsed = exp.symbols[k];
            if(!ctx.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
                ctx.symbolsUsed.push(symbolUsed);
            };
        }

        pilCodeGen(ctx, symbols, expressions, j, 0);
        const code = buildCode(ctx, expressions);
        const expInfo = {
            expId: j,
            stage: exp.stage,
            symbols: exp.symbols,
            code,
            dest: exprDest, 
        }

        expressionsCode.push(expInfo);
    }

    return expressionsCode;
}

module.exports.generateStagesCode = function generateStagesCode(res, expressionsInfo, symbols, expressions, stark) {
    const ctx = {
        calculated: {},
        symbolsCalculated: [],
        symbolsUsed: [],
        tmpUsed: 0,
        code: [],
        dom: "n",
        airId: res.airId,
        subproofId: res.subproofId,
        stark,
    };

    expressionsInfo.stagesCode = [];

    for(let stage = 1; stage <= res.nStages; ++stage) {
        for(let j = 0; j < expressions.length; ++j) {
            if(expressions[j].stage === stage) {
                let symbolDest = symbols.find(s => s.expId === j && s.airId === res.airId && s.subproofId === res.subproofId);
                if(!symbolDest) continue;
                let skip = false;
                for(let k = 0; k < expressions[j].symbols.length; k++) {
                    const symbol = expressions[j].symbols[k];
                    const imPol = res.cmPolsMap[symbol.id].imPol;
                    if(!imPol && (symbol.stage > stage || (stage != 1 && symbol.op === "cm" && symbol.stage === stage))) {
                        skip = true;
                        break; 
                    }
                }

                if(skip) continue;
                if(symbolDest.type === "witness" || (symbolDest.type === "tmpPol" && symbolDest.imPol)) {
                    ctx.symbolsCalculated.push({ op: "cm", stage: symbolDest.stage, stageId: symbolDest.stageId, id: symbolDest.polId});
                } else {
                    ctx.symbolsCalculated.push({ op: "tmp",  stage: symbolDest.stage, stageId: symbolDest.stageId, id: symbolDest.polId});
                }
                
                for(let k = 0; k < expressions[j].symbols.length; k++) {
                    const symbolUsed = expressions[j].symbols[k];
                    if(!ctx.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
                        ctx.symbolsUsed.push(symbolUsed);
                    };
                }
                pilCodeGen(ctx, symbols, expressions, j, 0);
            }
        }
        expressionsInfo.stagesCode.push(buildCode(ctx, expressions));
    }
}

module.exports.generateConstraintsDebugCode = function generateConstraintsDebugCode(res, symbols, constraints, expressions, stark) {
    const constraintsCode = [];
    for(let j = 0; j < constraints.length; ++j) {
        const ctx = {
            calculated: {},
            symbolsUsed: [],
            symbolsCalculated: [],
            tmpUsed: 0,
            code: [],
            dom: "n",
            airId: res.airId,
            subproofId: res.subproofId,
            stark,
        };

        const e = expressions[constraints[j].e];
        for(let k = 0; k < e.symbols.length; k++) {
            const symbolUsed = e.symbols[k];
            if(!ctx.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
                ctx.symbolsUsed.push(symbolUsed);
            };
        }

        pilCodeGen(ctx, symbols, expressions, constraints[j].e, 0, true);
        const constraint = buildCode(ctx, expressions);
        constraint.boundary = constraints[j].boundary;
        constraint.line = constraints[j].line;
        constraint.filename = constraints[j].fileName;
        constraint.stage = constraints[j].stage;
        if(constraints[j].boundary === "everyFrame") {
            constraint.offsetMin = constraints[j].offsetMin;
            constraint.offsetMax = constraints[j].offsetMax;
        }
        constraintsCode[j] = constraint;
    }
    return constraintsCode;
}


module.exports.generateConstraintPolynomialCode = function generateConstraintPolynomialCode(res, expressionsInfo, symbols, constraints, expressions, stark) {
    const ctxExt = {
        calculated: {},
        symbolsCalculated: [],
        symbolsUsed: [],
        tmpUsed: 0,
        code: [],
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

    for(let k = 0; k < expressions[res.cExpId].symbols.length; k++) {
        const symbolUsed = expressions[res.cExpId].symbols[k];
        if(!ctxExt.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
            ctxExt.symbolsUsed.push(symbolUsed);
        };
    } 

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
    const qCode = buildCode(ctxExt, expressions);
    qCode.code[qCode.code.length-1].dest = { type: "q", id: 0, dim: res.qDim };
    expressionsInfo.stagesCode.push(qCode);
}

module.exports.generateConstraintPolynomialVerifierCode = function generateConstraintPolynomialVerifierCode(res, verifierInfo, symbols, expressions, stark) {       
    let addMul = stark ? false : true;

    let ctx = {
        calculated: {},
        tmpUsed: 0,
        code: [],
        evMap: [],
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
    verifierInfo.qVerifier = buildCode(ctx, expressions);

    res.evMap = ctx.evMap;

    if (stark) {
        let qIndex = res.cmPolsMap.findIndex(p => p.stageNum === res.nStages + 1 && p.stageId === 0);
        for (let i = 0; i < res.qDeg; i++) {
            const rf = { type: "cm", id: qIndex + i, prime: 0 };
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


module.exports.generateFRICode = function generateFRICode(res, expressionsInfo, verifierInfo, symbols, expressions) {
    const ctxExt = {
        calculated: {},
        symbolsUsed: [],
        symbolsCalculated: [],
        tmpUsed: 0,
        code: [],
        dom: "ext",
        airId: res.airId,
        subproofId: res.subproofId,
        stark: true,
    };


    const friExpId = res.friExpId;

    for(let k = 0; k < expressions[friExpId].symbols.length; k++) {
        const symbolUsed = expressions[friExpId].symbols[k];
        if(!ctxExt.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
            ctxExt.symbolsUsed.push(symbolUsed);
        };
    } 

    pilCodeGen(ctxExt, symbols, expressions, friExpId, 0);
    const friCode = buildCode(ctxExt, expressions);
    friCode.code[friCode.code.length-1].dest = { type: "f", id: 0, dim: 3 };
    expressionsInfo.stagesCode.push(friCode);
    
    let addMul = false;

    ctxExt.verifierQuery = true;
    ctxExt.addMul = addMul;
    pilCodeGen(ctxExt, symbols, expressions, friExpId, 0);
    verifierInfo.queryVerifier = buildCode(ctxExt, expressions);
}
