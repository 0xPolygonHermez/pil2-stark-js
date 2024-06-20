const { calculateH1H2, calculateS, calculateZ } = require("../helpers/polutils");
const { getPol, setPol, setSubproofValue, calculateExpression } = require("./prover_helpers");
const { isSymbolCalculated, setSymbolCalculated } = require("./symbols_helpers");

module.exports.applyHints = async function applyHints(stage, ctx, options) {

    const hints = ctx.expressionsInfo.hintsInfo;
    for(let i = 0; i < hints.length; i++) {
        const hint = hints[i];

        if(isHintResolved(ctx, hint, options)) {
            if(options?.logger) options.logger.debug(`Hint ${i} already resolved`);
        } else if(canResolveHint(ctx, hint, options)) {
            await resolveHint(ctx, hint, options);
        } else {
            if(options?.logger) options.logger.debug(`Skipping hint ${i} because it can not be resolved`);
        }
    }
}

function getHintField(ctx, hint, field, dest = false) {
    const hintField = hint.fields.find(f => f.name === field);
    if(!hintField) throw new Error(`${field} field is missing`);
    if((hintField.op === "cm")) {
        if (dest) return hintField;
        return getPol(ctx, hintField.id, "n");
    }
    if(hintField.op === "tmp") return calculateExpression(ctx, hintField.expId);
    if((hintField.op === "number")) return BigInt(hintField.value);
    if(["subproofValue", "public"].includes(hintField.op)) return hintField;
    throw new Error("Case not considered");
}

function canResolveHint(ctx, hint) {
    if(hint.name === "subproofValue" || hint.name === "public") {
        const expression = hint.fields.find(f => f.name === "expression");
        if(["cm", "tmp"].includes(expression.op) && !isSymbolCalculated(ctx, expression)) return false;
    } else if (hint.name === "gsum" || hint.name === "gprod") {
        const numerator = hint.fields.find(f => f.name === "numerator");
        const denominator = hint.fields.find(f => f.name === "denominator");
        if((["cm", "tmp"].includes(numerator.op) && !isSymbolCalculated(ctx, numerator)) 
            || (["cm", "tmp"].includes(denominator.op) && !isSymbolCalculated(ctx, denominator))) return false;
    } else if (hint.name === "h1h2") {
        const f = hint.fields.find(f => f.name === "f");
        const t = hint.fields.find(f => f.name === "t");
        if((["cm", "tmp"].includes(f.op) && !isSymbolCalculated(ctx, f)) 
        || (["cm", "tmp"].includes(t.op) && !isSymbolCalculated(ctx, t))) return false;
    } else throw new Error("Unknown hint type " + hint.name);

    return true;
}

function isHintResolved(ctx, hint) {
    if(hint.name === "subproofValue") {
        const subAirValue = getHintField(ctx, hint, "reference");
        return isSymbolCalculated(ctx, subAirValue);
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

    if(hint.name === "subproofValue") {
        const polinomial = getHintField(ctx, hint, "expression");
        const position = getHintField(ctx, hint, "row_index");
        const value = polinomial[position];

        const subAirValue = getHintField(ctx, hint, "reference");
        ctx.subproofValues[subAirValue.id] = value;
        setSubproofValue(ctx, subAirValue.id, value, options);
    } else if (hint.name === "public") {
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
    } else if(hint.name === "gprod") {
        let numerator = getHintField(ctx, hint, "numerator");
        let denominator = getHintField(ctx, hint, "denominator");
        let gprod = await calculateZ(ctx.F, numerator, denominator);
        let gprodField = getHintField(ctx, hint, "reference", true);
        setPol(ctx, gprodField.id, gprod, "n", options);
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