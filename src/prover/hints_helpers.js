const { calculateH1H2 } = require("../helpers/polutils");
const { isSymbolCalculated, getPol, setPublicValue, setSubAirValue, setPolByReference } = require("./prover_helpers");

module.exports.applyHints = async function applyHints(stage, ctx, options) {
    for(let i = 0; i < ctx.pilInfo.hints.length; i++) {
        const hint = ctx.pilInfo.hints[i];
        if(hint.stage !== stage) continue;

        const referenceFields = Object.keys(hint).filter(k => k.includes("reference"));
        let isCalculated = true;
        for(let j = 0; j < referenceFields.length; ++j) {
            if(isSymbolCalculated(ctx, hint[referenceFields[j]])) {
                if(options?.logger) options.logger.debug(`Hint ${i} ${referenceFields[j]} is already calculated`);
            } else {
                isCalculated = false;
                break;
            }
        }

        if(isCalculated) continue;

        const symbolsMissing = [];
        for(let j = 0; j < hint.symbols.length; ++j) {
            const symbol = hint.symbols[j];
            if(!isSymbolCalculated(ctx, symbol)) {
                symbolsMissing.push(symbol);
            }
        }
        if(symbolsMissing.length !== 0) {
            if(options?.logger) options.logger.debug(`Skipping hint ${i} because ${symbolsMissing.length} symbols: ${JSON.stringify(symbolsMissing)} are missing`);
            continue;
        }

        if(options?.logger) options.logger.debug(`Calculating hint ${i}`);
        await resolveHint(ctx, hint, options);
    }
}

function getHintField(ctx, hintField) {
    if(hintField.op === "cm") {
        const idPol = ctx.pilInfo.cmPolsMap.findIndex(c => c.stage !== "tmpExp" && c.stageNum === hintField.stage && c.stageId === hintField.stageId);
        return getPol(ctx, idPol, "n");
    } else if(hintField.op === "tmp") {
        const idPol = ctx.pilInfo.cmPolsMap.findIndex(c => c.stage === "tmpExp" && c.stageNum === hintField.stage && c.stageId === hintField.stageId);
        return getPol(ctx, idPol, "n");
    } else if(["number", "subproofvalue"].includes(hintField.op)) {
        return BigInt(hintField.value);
    } else throw new Error("Case not considered");
}

async function resolveHint(ctx, hint, options) {
    if(hint.name === "subproofvalue" || hint.name === "public") {
        if(!hint.reference) throw new Error("Reference field is missing");
        if(!hint.expression) throw new Error("Expression field is missing");
        if(!hint.row_index) throw new Error("Row_index field is missing");

        const pol = getHintField(ctx, hint.expression)
        const value = pol[parseInt(hint.row_index.value)];

        if(hint.name === "public") {
            setPublicValue(ctx, hint.reference.id, hint.stage, value);
        } else {
            setSubAirValue(ctx, hint.reference.id, hint.stage, value);
        }    
    } else if(hint.name === "gsum") {
        const gsum = [];

        let numerator = getHintField(ctx, hint.numerator);
        let denominator = getHintField(ctx, hint.denominator);

        // TODO: THIS IS A HACK, REMOVE WHEN PIL2 IS FIXED
        if(numerator === 5n) numerator = ctx.F.negone;

        const denInv = await ctx.F.batchInverse(denominator);

        for(let i = 0; i < ctx.N; ++i) {
            const val = ctx.F.mul(numerator, denInv[i]);
            if(i === 0) {
                gsum[i] = val;
            } else {
                gsum[i] = ctx.F.add(gsum[i - 1], val);
            }
        }

        setPolByReference(ctx, hint.reference, gsum, "n", options);

    } else if(hint.name === "gprod") {
        const gprod = [];

        let numerator = getHintField(ctx, hint.numerator);
        let denominator = getHintField(ctx, hint.denominator);

        const denInv = await ctx.F.batchInverse(denominator);

        gprod[0] = ctx.F.one;
        for (let i=1; i<ctx.N; i++) {
            gprod[i] = ctx.F.mul(gprod[i-1], ctx.F.mul(numerator[i-1], denInv[i-1]));
        }

        console.log(hint.dest);
        setPolByReference(ctx, hint.reference, gprod, "n", options);

    } else if(hint.name === "h1h2") {
        let f = getHintField(ctx, hint.f);
        let t = getHintField(ctx, hint.t);
        const H1H2 = calculateH1H2(ctx.F, f, t);
        setPolByReference(ctx, hint.referenceH1, H1H2[0], "n", options);
        setPolByReference(ctx, hint.referenceH2, H1H2[1], "n", options);
    } else throw new Error(`Hint ${hint.name} cannot be resolved.`);
}