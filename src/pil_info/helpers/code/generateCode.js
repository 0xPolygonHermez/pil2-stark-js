const { pilCodeGen, buildCode } = require("./codegen");

// TODO: COMPLETE!
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
            if(["cm", "const", "tmp"].includes(symbolUsed.op)) {
                if(!ctx.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
                    ctx.symbolsUsed.push(symbolUsed);
                };
            }
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

    res.expressionsCode = expressionsCode;
}

module.exports.generateStagesCode = function generateStagesCode(res, symbols, expressions, stark) {
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

    const nStages = res.numChallenges.length;

    for(let stage = 1; stage <= nStages; ++stage) {
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
                    if(["cm", "const", "tmp"].includes(symbolUsed.op)) {
                        if(!ctx.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
                            ctx.symbolsUsed.push(symbolUsed);
                        };
                    }  
                }
                pilCodeGen(ctx, symbols, expressions, j, 0);
            }
        }
        res.code[`stage${stage}`] =  buildCode(ctx, expressions);
    }
}

module.exports.generateConstraintsDebugCode = function generateConstraintsDebugCode(res, symbols, constraints, expressions, stark) {
    for(let i = 0; i < res.numChallenges.length; ++i) {
        const ctx = {
            calculated: {},
            symbolsUsed: [],
            tmpUsed: 0,
            code: [],
            dom: "n",
            airId: res.airId,
            subproofId: res.subproofId,
            stark,
        };
        const stage = i + 1;
        const stageConstraints = constraints.filter(c => c.stage === stage);
        res.constraints[`stage${stage}`] = [];
        for(let j = 0; j < stageConstraints.length; ++j) {
            const e = expressions[stageConstraints[j].e];
            for(let k = 0; k < e.symbols.length; k++) {
                const symbolUsed = e.symbols[k];
                if(["cm", "const", "tmp"].includes(symbolUsed.op)) {
                    if(!ctx.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
                        ctx.symbolsUsed.push(symbolUsed);
                    };
                }  
            }

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
        if(!["cm", "const"].includes(symbolUsed.op)) continue;
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
            const rf = { type: "cm", id: res.qs[i], name: "Q" + i, prime: 0, dim: res.qDim, stage: res.numChallenges.length + 1, airId: res.airId, subproofId: res.subproofId };
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


module.exports.generateFRICode = function generateFRICode(res, symbols, expressions) {
    const ctxExt = {
        calculated: {},
        symbolsUsed: [],
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
        if(!["cm", "const"].includes(symbolUsed.op)) continue;
        if(!ctxExt.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
            ctxExt.symbolsUsed.push(symbolUsed);
        };
    } 

    pilCodeGen(ctxExt, symbols, expressions, friExpId, 0);
    res.code.fri = buildCode(ctxExt, expressions);
    res.code.fri.code[res.code.fri.code.length-1].dest = { type: "f", id: 0, dim: 3 };

    let addMul = false;

    ctxExt.verifierQuery = true;
    ctxExt.addMul = addMul;
    pilCodeGen(ctxExt, symbols, expressions, friExpId, 0);
    res.code.queryVerifier = buildCode(ctxExt, expressions);
}
