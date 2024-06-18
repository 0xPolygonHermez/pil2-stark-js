const { callCalculateExps } = require("./prover_helpers");

module.exports.isStageCalculated = function isStageCalculated(ctx, stage, options) {
    
    let symbolsToBeCalculated = 0;
    
    for(let i = 0; i < ctx.pilInfo.cmPolsMap.length; ++i) {
        const cmPol = ctx.pilInfo.cmPolsMap[i];
        if(cmPol.stageNum !== stage || cmPol.stage === "tmpExp" || cmPol.imPol) continue;
        if(!module.exports.isSymbolCalculated(ctx, {op: "cm", id: i})) {
            symbolsToBeCalculated++;
        }
    }

    for(let i = 0; i < ctx.pilInfo.challengesMap.length; ++i) {
        if(ctx.pilInfo.challengesMap[i].stageNum !== stage) continue;
        if(!module.exports.isSymbolCalculated(ctx, {op: "challenge", id: i})) {
            symbolsToBeCalculated++;
        }
    }

    if(stage == 1) {
        for(let i = 0; i < ctx.pilInfo.constPolsMap.length; ++i) {
            if(!module.exports.isSymbolCalculated(ctx, {op: "const", id: i})) {
                symbolsToBeCalculated++;
            }
        }

        for(let i = 0; i < ctx.pilInfo.nPublics; ++i) {
            if(!module.exports.isSymbolCalculated(ctx, {op: "public", id: i})) {
                symbolsToBeCalculated++;
            }
        }
    }

    if(stage === ctx.pilInfo.nStages) {
        for(let i = 0; i < ctx.pilInfo.nSubproofValues; ++i) {
            if(!module.exports.isSymbolCalculated(ctx, {op: "subproofValue", id: i})) {
                symbolsToBeCalculated++;
            }
        }
    }


    return symbolsToBeCalculated;
}

module.exports.isSymbolCalculated = function isSymbolCalculated(ctx, symbol) {
    const op = symbol.op === "tmp" ? "cm" : symbol.op;
    return ctx.calculatedSymbols[op][symbol.id];
}

module.exports.setSymbolCalculated = function setSymbolCalculated(ctx, ref, options) {
    if(!module.exports.isSymbolCalculated(ctx, ref)) {
        
        const op = ref.op === "tmp" ? "cm" : ref.op;
        ctx.calculatedSymbols[op][ref.id] = true;
        if(options?.logger) options.logger.debug(`Symbol ${ref.op} for with id ${ref.id} has been calculated`);
    }
}

module.exports.tryCalculateExps = async function tryCalculateExps(ctx, stage, dom, options) {
    const expressionsStage = ctx.expressionsInfo.expressionsCode.filter(e => e.stage === stage && e.dest);
    for(let i = 0; i < expressionsStage.length; ++i) {
        if(module.exports.isSymbolCalculated(ctx, expressionsStage[i].dest)) continue;
        const symbols = expressionsStage[i].symbols;
        const symbolsMissing = [];
        for(let j = 0; j < symbols.length; ++j) {
            const symbol = symbols[j];
            if(!module.exports.isSymbolCalculated(ctx, symbol)) {
                symbolsMissing.push(symbol);
            }
        }
        if(symbolsMissing.length === 0) {
            if(options.logger) options.logger.debug(`Calculating expression ${expressionsStage[i].expId}`);
            await callCalculateExps(stage, expressionsStage[i].code, dom, ctx, options.parallelExec, options.useThreads);
            module.exports.setSymbolCalculated(ctx, expressionsStage[i].dest, options);
            if(options.logger) options.logger.debug(`Expression ${expressionsStage[i].expId} calculated`);
        } else {
            if(options.logger) options.logger.debug(`Skipping expression ${expressionsStage[i].expId} because ${symbolsMissing.length} symbols are missing`);
        }
    }
}
