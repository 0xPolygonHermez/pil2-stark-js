const { calculateH1H2, calculateS, calculateZ } = require("../helpers/polutils");
const { getPol, setPol, setAirgroupValue, calculateExpression, getFixedPol } = require("./prover_helpers");
const { isSymbolCalculated, setSymbolCalculated } = require("./symbols_helpers");

module.exports.applyHints = async function applyHints(stage, ctx, options) {

    const hints = ctx.expressionsInfo.hintsInfo;
    for(let i = 0; i < hints.length; i++) {
        const hint = hints[i];

        if(isHintResolved(ctx, hint, options)) {
            if(options?.logger) options.logger.debug(`Hint ${i} already resolved`);
        } else if(canResolveHint(ctx, hint, stage, options)) {
            await resolveHint(ctx, hint, options);
        } else {
            if(options?.logger) options.logger.debug(`Skipping hint ${i} because it can not be resolved`);
        }
    }
}

function getHintField(ctx, hint, field, dest = false, debug = false) {
    const hintField = hint.fields.find(f => f.name === field);

    if (!hintField) throw new Error(`${field} field is missing`);

    if (dest) return hintField;

    if (hintField.op === "const") return getFixedPol(ctx, hintField.id);
    if ((hintField.op === "cm")) return getPol(ctx, hintField.id, "n");
    if (hintField.op === "tmp") return calculateExpression(ctx, hintField.id, debug);
    if ((hintField.op === "number")) return BigInt(hintField.value);
    if (["airgroupvalue", "public"].includes(hintField.op)) return hintField;
    throw new Error("Case not considered");
}

function canResolveHint(ctx, hint, stage) {
    if(hint.name === "airgroupvalue" || hint.name === "public") {
        const expression = hint.fields.find(f => f.name === "expression");
        if(expression.op === "cm" && !isSymbolCalculated(ctx, expression)) return false;
    } else if (hint.name === "gsum" || hint.name === "gprod") {
        const numerator = hint.fields.find(f => f.name === "numerator");
        const denominator = hint.fields.find(f => f.name === "denominator");
        if((numerator.op === "cm" && !isSymbolCalculated(ctx, numerator))
            || (denominator.op === "cm" && !isSymbolCalculated(ctx, denominator))) return false;
        const reference = hint.fields.find(f => f.name === "reference");
        if(ctx.pilInfo.cmPolsMap[reference.id].stage !== stage) return false;
    } else if (hint.name === "h1h2") {
        const f = hint.fields.find(f => f.name === "f");
        const t = hint.fields.find(f => f.name === "t");
        if((f.op === "cm" && !isSymbolCalculated(ctx, f)) 
        || (t.op === "cm" && !isSymbolCalculated(ctx, t))) return false;
        const h1 = hint.fields.find(f => f.name === "referenceH1");
        if(ctx.pilInfo.cmPolsMap[h1.id].stage !== stage) return false;
    } else throw new Error("Unknown hint type " + hint.name);

    return true;
}

function isHintResolved(ctx, hint) {
    if(hint.name === "airgroupvalue") {
        const airgroupvalue = getHintField(ctx, hint, "reference");
        return isSymbolCalculated(ctx, airgroupvalue);
    } else if(hint.name === "public") {
        const public = getHintField(ctx, hint, "reference");
        return isSymbolCalculated(ctx, public);
    } else if(hint.name === "gsum") {
        const s = getHintField(ctx, hint, "reference", true);
        return isSymbolCalculated(ctx, s);
    } else if(hint.name === "gprod") {
        const z = getHintField(ctx, hint, "reference", true);
        return isSymbolCalculated(ctx, z);
    } else if(hint.name === "h1h2") {
        const h1 = getHintField(ctx, hint, "referenceH1", true);
        const h2 = getHintField(ctx, hint, "referenceH2", true);
        return isSymbolCalculated(ctx, h1) && isSymbolCalculated(ctx, h2);
    } else throw new Error("Unknown hint type " + hint.name);
}



async function resolveHint(ctx, hint, options) {
    if(options?.logger) options.logger.debug(`Calculating hint ${hint.name} with fields: ${hint.fields.map(f => f.name).join(", ")}`);

    if (hint.name === "public") {
        const polinomial = getHintField(ctx, hint, "expression");
        const position = getHintField(ctx, hint, "row_index");
        const value = polinomial[position];

        const public = getHintField(ctx, hint, "reference");
        ctx.publics[public.id] = value;
        setSymbolCalculated(ctx, public, options);
    } else if(hint.name === "gsum") {
        let numerator = getHintField(ctx, hint, "numerator");
        let denominator = getHintField(ctx, hint, "denominator");
        let gsum = await calculateS(ctx.F, numerator, denominator);
        let gsumField = getHintField(ctx, hint, "reference", true);
        setPol(ctx, gsumField.id, gsum, "n", options);
        if(hint.fields.find(f => f.name === "result")) {
            const value = gsum[ctx.N - 1];
            const airgroupvalue = getHintField(ctx, hint, "result");
            setAirgroupValue(ctx, airgroupvalue.id, value, options);
        }
    } else if(hint.name === "gprod") {
        let numerator = getHintField(ctx, hint, "numerator");
        let denominator = getHintField(ctx, hint, "denominator");
        let gprod = await calculateZ(ctx.F, numerator, denominator);
        let gprodField = getHintField(ctx, hint, "reference", true);
        setPol(ctx, gprodField.id, gprod, "n", options);
        if(hint.fields.find(f => f.name === "result")) {
            const value = gprod[ctx.N - 1];
            const airgroupvalue = getHintField(ctx, hint, "result");
            setAirgroupValue(ctx, airgroupvalue.id, value, options);
        }
    } else if(hint.name === "h1h2") {
        let f = getHintField(ctx, hint, "f");
        let t = getHintField(ctx, hint, "t");
        const H1H2 = calculateH1H2(ctx.F, f, t);
        const h1Field = getHintField(ctx, hint, "referenceH1", true);
        const h2Field = getHintField(ctx, hint, "referenceH2", true);
        setPol(ctx, h1Field.id, H1H2[0], "n", options);
        setPol(ctx, h2Field.id, H1H2[1], "n", options);
    } else throw new Error(`Hint ${hint.name} cannot be resolved.`);
}

module.exports.getHintField = getHintField;
