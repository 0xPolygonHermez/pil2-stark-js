const { calculateH1H2 } = require("../helpers/polutils");
const { getPol, setPol } = require("./prover_helpers");
const { isSymbolCalculated, setSymbolCalculated } = require("./symbols_helpers");

module.exports.applyHints = async function applyHints(stage, ctx, options) {
    for(let i = 0; i < ctx.pilInfo.hints.length; i++) {
        const hint = ctx.pilInfo.hints[i];
        const stageHint = hint.dest[0].stage;
        if(stageHint !== stage) continue;

        let isHintCalculated = hint.dest.map(d => isSymbolCalculated(ctx, d)).every(d => d);        
        if(isHintCalculated) continue;

        const symbolsMissing = hint.symbols.filter(symbol => !isSymbolCalculated(ctx, symbol));
        if(symbolsMissing.length !== 0) {
            if(options?.logger) options.logger.debug(`Skipping hint ${i} because ${symbolsMissing.length} symbols: ${JSON.stringify(symbolsMissing)} are missing`);
            continue;
        }

        await resolveHint(ctx, hint, options);
    }
}

function getHintField(ctx, hint, field, options = {}) {
    if(!hint[field]) throw new Error(`${field} field is missing`);
    if(["cm", "tmp"].includes(hint[field].op)) {
        return getPol(ctx, hint[field].id, "n");
    }
    if(["number", "subproofvalue"].includes(hint[field].op)) return BigInt(hint[field].value);
    throw new Error("Case not considered");
}

async function resolveHint(ctx, hint, options) {
    if(options?.logger) hint.dest.forEach(dest => options.logger.debug(`Calculating hint ${hint.name} -> op: ${dest.op}, stage: ${dest.stage}, ${dest.op === "cm" ? `stageId: ${dest.stageId}` : `id: ${dest.id}`}`));

    if(hint.name === "subproofvalue" || hint.name === "public") {
        const pol = getHintField(ctx, hint, "expression", options);
        const pos = getHintField(ctx, hint, "row_index", options);
        const value = pol[pos];

        if(hint.name === "public") {
            ctx.publics[hint.dest[0].id] = value;
            setSymbolCalculated(ctx, hint.dest[0], options);
        } else {
            ctx.subAirValues[hint.dest[0].id] = value;
            setSymbolCalculated(ctx, hint.dest[0], options);
        }    
    } else if(hint.name === "gsum") {
        if(!hint.numerator) throw new Error("Numerator field is missing");
        if(!hint.denominator) throw new Error("Denominator field is missing");

        const gsum = [];

        let numerator = getHintField(ctx, hint, "numerator", options);
        let denominator = getHintField(ctx, hint, "denominator", options);

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

        setPol(ctx, hint.dest[0].id, gsum, "n");
        setSymbolCalculated(ctx, hint.dest[0], options);

    } else if(hint.name === "gprod") {
        const gprod = [];

        let numerator = getHintField(ctx, hint, "numerator", options);
        let denominator = getHintField(ctx, hint, "denominator", options);

        const denInv = await ctx.F.batchInverse(denominator);

        gprod[0] = ctx.F.one;
        for (let i=1; i<ctx.N; i++) {
            gprod[i] = ctx.F.mul(gprod[i-1], ctx.F.mul(numerator[i-1], denInv[i-1]));
        }

        setPol(ctx, hint.dest[0].id, gprod, "n");
        setSymbolCalculated(ctx, hint.dest[0], options);

    } else if(hint.name === "h1h2") {
        let f = getHintField(ctx, hint, "f", options);
        let t = getHintField(ctx, hint, "t", options);
        const H1H2 = calculateH1H2(ctx.F, f, t);
        setPol(ctx, hint.dest[0].id, H1H2[0], "n");
        setPol(ctx, hint.dest[1].id, H1H2[1], "n");
        setSymbolCalculated(ctx, hint.dest[0], options);
        setSymbolCalculated(ctx, hint.dest[1], options);
    } else throw new Error(`Hint ${hint.name} cannot be resolved.`);
}
