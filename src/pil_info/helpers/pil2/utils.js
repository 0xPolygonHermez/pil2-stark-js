const ProtoOut = require("pilcom2/src/proto_out.js");
const ExpressionOps = require("../../expressionops");
const { getExpDim } = require("../helpers");

const piloutTypes =  {
    FIXED_COL: 1,
    WITNESS_COL: 3,
    SUBPROOF_VALUE: 5,
    PUBLIC_VALUE: 6,
    CHALLENGE: 8,
}

module.exports.formatExpressions = function formatExpressions(pilout, stark, saveSymbols = false) {
    const symbols = [];

    const expressions = pilout.expressions.map(e => formatExpression(e, pilout, symbols, stark, saveSymbols));
    
    if(!saveSymbols) {
        return { expressions };
    } else {
        return { expressions, symbols};
    }
}

module.exports.formatHints = function formatHints(pilout, rawHints, symbols, expressions, stark, saveSymbols) {
    const hints = [];

    for(let i = 0; i < rawHints.length; ++i) {
        const hint = { name: rawHints[i].name };
        const fields = rawHints[i].hintFields[0].hintFieldArray.hintFields;
        for(let j = 0; j < fields.length; j++) {
            const name = fields[j].name;
            const value = formatExpression(fields[j].operand, pilout, symbols, stark, saveSymbols);
            if(value.op === "exp") expressions[value.id].keep = true;
            hint[name] = value;
        }
        hints.push(hint);
    }
    return hints;
}


function formatExpression(exp, pilout, symbols, stark, saveSymbols = false) {
    const P = new ProtoOut();
    
    if(exp.op) return exp;

    let op = Object.keys(exp)[0];
    
    let store = false;

    if(op === "expression") {
        const id = exp[op].idx;
        exp = { op: "exp", id };
    } else if(["add", "mul", "sub"].includes(op)) {
        const lhs = formatExpression(exp[op].lhs, pilout, symbols, stark, saveSymbols);
        const rhs = formatExpression(exp[op].rhs, pilout, symbols, stark, saveSymbols);
        exp = { op, values: [lhs, rhs] };
    } else if(op === "neg") {
        const value = formatExpression(exp[op].value, pilout, symbols, stark, saveSymbols);
        exp = { op, values: [value] };
    } else if (op === "constant") {
        const value = P.buf2bint(exp.constant.value).toString();
        exp = { op: "number", value };
    } else if (op === "witnessCol") {
        const id =  exp[op].colIdx + pilout.stageWidths.slice(0, exp[op].stage - 1).reduce((acc, c) => acc + c, 0);
        const dim = exp[op].stage === 1 ? 1 : stark ? 3 : 1;
        const stageId = exp[op].colIdx;
        const rowOffset = exp[op].rowOffset;
        const stage = exp[op].stage;
        const subproofId = exp[op].subproofId;
        const airId = exp[op].subproofId;
        exp = { op: "cm", id, stageId, rowOffset, stage, dim, subproofId, airId };
        store = true;
    } else if (op === "fixedCol") {
        const id = exp[op].idx;
        const rowOffset = exp[op].rowOffset;
        const subproofId = exp[op].subproofId;
        const airId = exp[op].subproofId;
        exp = { op: "const", id, rowOffset, stage: 0, dim: 1, subproofId, airId };
        store = true;
    } else if (op === "publicValue") {
        const id = exp[op].idx;
        exp = { op: "public", id, stage: 1 };
        store = true;
    } else if (op === "subproofValue") {
        const id = exp[op].idx;
        const stage = pilout.numChallenges.length;
        const subproofId = exp[op].subproofId;
        exp = { op: "subproofValue", id, stage, subproofId };
        store = true;
    } else if (op === "challenge") {
        const id = exp[op].idx + pilout.numChallenges.slice(0, exp[op].stage - 1).reduce((acc, c) => acc + c, 0);
        const stageId = exp[op].idx;
        const stage = exp[op].stage;
        exp = { op: "challenge", stage, stageId, id };
        store = true;
    } else throw new Error("Unknown op: " + op);

    if(saveSymbols && store) {
        addSymbol(symbols, exp, stark);
    }

    return exp;
}

function addSymbol(symbols, exp, stark) {
    let subproofId = exp.subproofId || 0;
    let airId = exp.airId || 0;
    if(exp.op === "public") {
        const publicSymbol = symbols.find(s => s.type === "public" && s.id === exp.id);
        if(!publicSymbol) {
            const name = "public_" + exp.id;
            symbols.push({type: "public", dim: 1, id: exp.id, name });
        }
    } else if(exp.op === "challenge") {
        const challengeSymbol = symbols.find(s => s.type === "challenge" && s.stage === exp.stage && s.stageId === exp.stageId);
        if(!challengeSymbol) {
            const dim = stark ? 3 : 1;
            const name = "challenge_" + exp.stage + "_" + exp.stageId;
            const id = symbols.filter(si => si.type === "challenge" && ((si.stage < exp.stage) || (si.stage === exp.stage && si.stageId < exp.stageId))).length;
            symbols.push({ type: "challenge", stageId: exp.stageId, stage: exp.stage, id, dim, name});
        }
    } else if(exp.op === "const") {
        const fixedSymbol = symbols.find(s => s.type === "fixed" && s.airId === airId && s.subproofId === subproofId
            && s.stage === exp.stage && s.id === exp.stageId);
        if(!fixedSymbol) {
            const name = "fixed_" + exp.id;
            symbols.push({ type: "fixed", polId: exp.id, stageId: exp.id, stage: exp.stage, dim: 1, name, airId , subproofId});
        }
    } else if(exp.op === "cm") {
        const witnessSymbol = symbols.find(s => s.type === "witness" && s.airId === airId && s.subproofId === subproofId
            && s.stage === exp.stage && s.stageId === exp.stageId);
        if(!witnessSymbol) {
            const name = "witness_" + exp.stage + "_" + exp.stageId;
            const dim = (exp.stage === 1 || !stark) ? 1 : 3;
            symbols.push({ type: "witness", polId: exp.id, stageId: exp.stageId, stage: exp.stage, dim, name, airId, subproofId});
        }
    } else if(exp.op === "subproofValue") {
        const subProofValueSymbol = symbols.find(s => s.type === "subproofValue" && s.id === exp.id && s.airId === airId && s.subproofId === subproofId);
        if(!subProofValueSymbol) {
            const name = "subproofvalue_" + exp.id;
            symbols.push({type: "subproofValue", dim: 1, id: exp.id, name, airId, subproofId });
        }
    } else {
        throw new Error ("Unknown operation " + exp.op);
    }
    return;
}


module.exports.formatConstraints = function formatConstraints(pilout) {
    const constraints = pilout.constraints.map(c => {
        let boundary = Object.keys(c)[0];
        let constraint = {
            boundary,
            e: c[boundary].expressionIdx.idx,
            line: c[boundary].debugLine,
        }

        if(boundary === "everyFrame") {
            constraint.offsetMin = c[boundary].offsetMin;
            constraint.offsetMax = c[boundary].offsetMax;
        }
        return constraint;
    });

    return constraints;
}

module.exports.formatSymbols = function formatSymbols(pilout, stark) {
    const E = new ExpressionOps();

    const symbols = pilout.symbols.flatMap(s => {
        if([piloutTypes.FIXED_COL, piloutTypes.WITNESS_COL].includes(s.type)) {
            const dim = ([0,1].includes(s.stage) || !stark) ? 1 : 3;
            const type = s.type === piloutTypes.FIXED_COL ? "fixed" : "witness";
            const previousPols = pilout.symbols.filter(si => si.type === s.type 
                && si.airId === s.airId && si.subproofId === s.subproofId
                && ((si.stage < s.stage) || (si.stage === s.stage && si.id < s.id)));
            let polId = 0;
            for(let i = 0; i < previousPols.length; ++i) {
                if (!previousPols[i].dim) {
                    polId++;
                } else {
                    polId += previousPols[i].lengths.reduce((acc, l) => acc * l, 1);
                }
            };
            if(!s.dim) {
                const stageId = s.id;
                E.cm(polId, 0, s.stage, dim);
                return {
                    name: s.name,
                    stage: s.stage,
                    type,
                    polId,
                    stageId,
                    dim,
                    airId: s.airId,
                    subproofId: s.subproofId,
                }  
            } else {
                const multiArraySymbols = [];
                generateMultiArraySymbols(E, multiArraySymbols, [], s, type, dim, polId, 0);
                return multiArraySymbols;
            }
        } else if(s.type === piloutTypes.CHALLENGE) {
            const id = pilout.symbols.filter(si => si.type === piloutTypes.CHALLENGE && ((si.stage < s.stage) || (si.stage === s.stage && si.id < s.id))).length;
            return {
                name: s.name,
                type: "challenge",
                stageId: s.id,
                id,
                stage: s.stage,
                dim: stark ? 3 : 1,
            }
        } else if(s.type === piloutTypes.PUBLIC_VALUE) {
            return {
                name: s.name,
                stage: 1,
                type: "public",
                dim: 1,
                id: s.id,
            }
        } else if(s.type === piloutTypes.SUBPROOF_VALUE) {
            return {
                name: s.name,
                type: "subproofValue",
                id: s.id,
                subproofId: s.subproofId,
                dim: stark ? 3 : 1,
                airId: s.airId,
                subproofId: s.subproofId,
            }
        }
    }); 

    return symbols;
}

function generateMultiArraySymbols(E, symbols, indexes, sym, type, dim, polId, shift) {
    if (indexes.length === sym.lengths.length) {
        E.cm(polId + shift, 0, sym.stage, dim);
        symbols.push({
            name: sym.name + shift,
            stage: sym.stage,
            type,
            polId: polId + shift,
            stageId: sym.id + shift,
            dim,
            airId: sym.airId,
            subproofId: sym.subproofId,
        });
        return shift + 1;
    }

    for (let i = 0; i < sym.lengths[indexes.length]; i++) {
        shift = generateMultiArraySymbols(E, symbols, [...indexes, i], sym, type, dim, polId, shift);
    }

    return shift;
}
