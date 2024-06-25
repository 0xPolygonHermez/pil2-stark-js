const { callCalculateExps } = require("./prover_helpers");

module.exports.isStageCalculated = function isStageCalculated(ctx, stage, options) {
    
    let symbolsToBeCalculated = 0;
    
    for(let i = 0; i < ctx.pilInfo.cmPolsMap.length; ++i) {
        const cmPol = ctx.pilInfo.cmPolsMap[i];
        if(cmPol.stage !== stage || cmPol.stage === "tmpExp" || cmPol.imPol) continue;
        if(!module.exports.isSymbolCalculated(ctx, {op: "cm", id: i})) {
            console.log(`Witness col ${cmPol.name} with id ${i} for stage ${cmPol.stage} is not calculated.`);
            symbolsToBeCalculated++;
        }
    }

    for(let i = 0; i < ctx.pilInfo.challengesMap.length; ++i) {
        const challenge = ctx.pilInfo.challengesMap[i];
        if(ctx.pilInfo.challengesMap[i].stage !== stage) continue;
        if(!module.exports.isSymbolCalculated(ctx, {op: "challenge", id: i})) {
            console.log(`Challenge ${challenge.stageId} for stage ${stage} is not calculated.`);
            symbolsToBeCalculated++;
        }
    }

    if(stage == 1) {
        for(let i = 0; i < ctx.pilInfo.constPolsMap.length; ++i) {
            const fixedCol = ctx.pilInfo.constPolsMap[i];
            if(!module.exports.isSymbolCalculated(ctx, {op: "const", id: i})) {
                console.log(`Fixed Col ${fixedCol.name} with id ${i} is not calculated.`);
                symbolsToBeCalculated++;
            }
        }

        for(let i = 0; i < ctx.pilInfo.nPublics; ++i) {
            const public = ctx.pilInfo.publicsMap[i];
            if(!module.exports.isSymbolCalculated(ctx, {op: "public", id: i})) {
                console.log(`Public ${public.name} with id ${i} is not calculated.`);
                symbolsToBeCalculated++;
            }
        }
    }

    if(stage === ctx.pilInfo.nStages) {
        for(let i = 0; i < ctx.pilInfo.nSubproofValues; ++i) {
            const subproofValue = ctx.pilInfo.subproofValuesMap[i];
            if(!module.exports.isSymbolCalculated(ctx, {op: "subproofValue", id: i})) {
                console.log(`Subproof value ${subproofValue.name} with id ${i} is not calculated.`);
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
        if(options?.logger) {
            if(op === "cm") options.logger.debug(`Witness ${ctx.pilInfo.cmPolsMap[ref.id].name} for with id ${ref.id} has been calculated`);
            if(op === "const") options.logger.debug(`Fixed ${ctx.pilInfo.constPolsMap[ref.id].name} for with id ${ref.id} has been calculated`);
            if(op === "challenge") options.logger.debug(`Challenge ${ctx.pilInfo.challengesMap[ref.id].name} for with id ${ref.id} has been calculated`);
            if(op === "public") options.logger.debug(`Public ${ctx.pilInfo.publicsMap[ref.id].name} for with id ${ref.id} has been calculated`);
            if(op === "subproofValue") options.logger.debug(`SubproofValue ${ctx.pilInfo.subproofValuesMap[ref.id].name} for with id ${ref.id} has been calculated`);
        }
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
