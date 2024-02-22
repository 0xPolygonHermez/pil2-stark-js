const { callCalculateExps } = require("./prover_helpers");

module.exports.checkWitnessStageCalculated = function checkWitnessStageCalculated(ctx, stage, options) {
    const stageWitness = ctx.pilInfo.cmPolsMap.filter(s => s.stageNum === stage);
    let witnessesToBeCalculated = 0;
    for(let i = 0; i < stageWitness.length; ++i) {
        let symbol;
        if(stageWitness[i].stage === "tmpExp") {
            symbol = { op: "tmp", stage: stageWitness[i].stageNum, stageId: stageWitness[i].stageId };
        } else {
            symbol = { op: "cm", stage: stageWitness[i].stageNum, stageId: stageWitness[i].stageId };
        }
        const isCalculated = module.exports.isSymbolCalculated(ctx, symbol);
        if(!isCalculated) {
            ++witnessesToBeCalculated;
        }
    }
    if(options.logger) options.logger.debug(`There are ${witnessesToBeCalculated} out of ${stageWitness.length} witness polynomials to be calculated in stage ${stage}`);
    return witnessesToBeCalculated;
}

module.exports.checkStageCalculated = function checkStageCalculated(ctx, stage, options) {
    const symbolsStage = ctx.pilInfo.symbolsStage[stage];
    let symbolsNotCalculated = [];
    for(let i = 0; i < symbolsStage.length; ++i) {
        if(!module.exports.isSymbolCalculated(ctx, symbolsStage[i])) {
            symbolsNotCalculated.push(symbolsStage[i]);
        };
    }
    if(symbolsNotCalculated.length > 0) {
        if(options.logger) options.logger.error(`Not all the symbols for the stage ${stage} has been calculated: ${symbolsNotCalculated.map(s => JSON.stringify(s))}`);
        throw new Error(`Not all the symbols for the stage ${stage} has been calculated`);
    }
}

module.exports.setConstantsPolynomialsCalculated = function setConstantsPolynomialsCalculated(ctx, options) {
    for(let i = 0; i < ctx.pilInfo.nConstants; ++i) {
        module.exports.setSymbolCalculated(ctx, {op: "const", stage: 0, id: i}, options);
    }
}

module.exports.setStage1PolynomialsCalculated = function setStage1PolynomialsCalculated(ctx, options) {
    for(let i = 0; i < ctx.pilInfo.cmPolsMap.filter(p => p.stage == "cm1").length; ++i) {
        const polInfo = ctx.pilInfo.cmPolsMap.filter(p => p.stage == "cm1")[i];
        if(!polInfo.imPol) {
            module.exports.setSymbolCalculated(ctx, {op: "cm", stage: 1, stageId: i}, options);
        }
    }
}

module.exports.isSymbolCalculated = function isSymbolCalculated(ctx, symbol) {
    const symbolFound = ctx.calculatedSymbols.find(s =>
        (["cm", "challenge"].includes(symbol.op) && symbol.op === s.op && symbol.stage === s.stage && symbol.stageId === s.stageId)
        || (symbol.op === "tmp" && symbol.op === s.op && symbol.stageId === s.stageId)
        || (["subproofValue", "public", "const"].includes(symbol.op) && symbol.op === s.op && symbol.stage === s.stage && symbol.id === s.id));

    const isCalculated = symbolFound ? true : false;
    return isCalculated;
}

module.exports.setSymbolCalculated = function setSymbolCalculated(ctx, ref, options) {
    let symbol;
    if(["cm", "challenge"].includes(ref.op)) {
        symbol = {op: ref.op, stage: ref.stage, stageId: ref.stageId}
    } else if(ref.op === "tmp") {
        symbol = {op: ref.op, stage: ref.stage, stageId: ref.stageId};
    } else if(["public", "subproofValue", "const"].includes(ref.op)) {
        symbol = {op: ref.op, stage: ref.stage, id: ref.id}
    } else throw new Error("Invalid ref op " + ref.op);

    if(!module.exports.isSymbolCalculated(ctx, symbol)) {
        ctx.calculatedSymbols.push(symbol);
        if(options?.logger) options.logger.debug(`Symbol ${symbol.op} for stage ${symbol.stage} and id ${["cm", "tmp", "challenge"].includes(symbol.op) ? symbol.stageId : symbol.id} has been calculated`);
    }
}

module.exports.tryCalculateExps = async function tryCalculateExps(ctx, stage, dom, options) {
    const expressionsStage = ctx.pilInfo.expressionsCode.filter(e => e.stage === stage && e.dest);
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
            await callCalculateExps(`stage${stage}`, expressionsStage[i].code, dom, ctx, options.parallelExec, options.useThreads);
            module.exports.setSymbolCalculated(ctx, expressionsStage[i].dest, options);
            if(options.logger) options.logger.debug(`Expression ${expressionsStage[i].expId} calculated`);
        } else {
            if(options.logger) options.logger.debug(`Skipping expression ${expressionsStage[i].expId} because ${symbolsMissing.length} symbols are missing`);
        }
    }
}