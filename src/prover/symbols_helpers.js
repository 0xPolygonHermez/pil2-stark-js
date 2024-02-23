const { callCalculateExps } = require("./prover_helpers");

module.exports.checkSymbolsCalculated = function checkSymbolsCalculated(ctx, stage, options) {
    const symbolsStage = ctx.pilInfo.symbolsStage[stage];
    let publicsToBeCalculated = 0;
    let subproofValuesToBeCalculated = 0;
    let commitsToBeCalculated = 0;
let tmpPolsToBeCalculated = 0;
    let symbolsCalculated = 0;
    let symbolsToBeCalculated = 0;
    for(let i = 0; i < symbolsStage.length; ++i) {
        if(!module.exports.isSymbolCalculated(ctx, symbolsStage[i])) {
            if(symbolsStage[i].op === "cm") {
                commitsToBeCalculated++;
}
            if(symbolsStage[i].op === "tmp") {
                tmpPolsToBeCalculated++;
            }
            if(symbolsStage[i].op === "public") publicsToBeCalculated++;
            if(symbolsStage[i].op === "subproofvalue") subproofValuesToBeCalculated++;
            symbolsToBeCalculated++;
        } else {
            symbolsCalculated++;
        };
    }
    let nCommits = symbolsStage.filter(s => s.op === "cm").length;
    let nTmpPols = symbolsStage.filter(s => s.op === "tmp").length;
    let nPublics = symbolsStage.filter(s => s.op === "public").length;
    let nSubproofValues = symbolsStage.filter(s => s.op === "subproofvalue").length;
    if(options.logger && nCommits > 0) options.logger.debug(`There are ${commitsToBeCalculated} out of ${nCommits} committed polynomials to be calculated in stage ${stage}`);
    if(options.logger && nTmpPols > 0) options.logger.debug(`There are ${tmpPolsToBeCalculated} out of ${nTmpPols} temporal polynomials to be calculated in stage ${stage}`);
    if(options.logger && nPublics > 0) options.logger.debug(`There are ${publicsToBeCalculated} out of ${nPublics} public values to be calculated in stage ${stage}`);
    if(options.logger && nSubproofValues > 0) options.logger.debug(`There are ${subproofValuesToBeCalculated} out of ${nSubproofValues} subproof values to be calculated in stage ${stage}`);
    return { totalSymbolsStage: symbolsStage.length, symbolsCalculated, symbolsToBeCalculated, tmpPolsToBeCalculated, commitsToBeCalculated, publicsToBeCalculated, subproofValuesToBeCalculated};
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
    console.log(symbol);
    if(["cm", "challenge"].includes(symbol.op)) {
        return ctx.calculatedSymbols[symbol.op][symbol.stage][symbol.stageId];
    } else if(symbol.op === "tmp") {
        return ctx.calculatedSymbols["tmp"][symbol.stageId];
    } else {
        return ctx.calculatedSymbols[symbol.op][symbol.id];
    }
}

module.exports.setSymbolCalculated = function setSymbolCalculated(ctx, ref, options) {
    if(!module.exports.isSymbolCalculated(ctx, ref)) {
        if(["cm", "challenge"].includes(ref.op)) {
            ctx.calculatedSymbols[ref.op][ref.stage][ref.stageId] = true;
        } else if(ref.op === "tmp") {
            ctx.calculatedSymbols["tmp"][ref.stageId] = true;
        } else {
            ctx.calculatedSymbols[ref.op][ref.id] = true;
        }
        if(options?.logger) options.logger.debug(`Symbol ${ref.op} for stage ${ref.stage} and id ${["cm", "tmp", "challenge"].includes(ref.op) ? ref.stageId : ref.id} has been calculated`);
    }
}

module.exports.tryCalculateExps = async function tryCalculateExps(ctx, stage, dom, options) {
    const expressionsStage = ctx.pilInfo.expressionsCode.filter(e => e.stage === stage);
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