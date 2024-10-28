const ProtoOut = require("pil2-compiler/src/proto_out.js");
const ExpressionOps = require("../../expressionops");

const piloutTypes =  {
    FIXED_COL: 1,
    WITNESS_COL: 3,
    AIRGROUP_VALUE: 5,
    PUBLIC_VALUE: 6,
    CHALLENGE: 8,
    AIR_VALUE: 9
}

module.exports.formatExpressions = function formatExpressions(pilout, stark, saveSymbols = false, global = false) {
    const symbols = [];

    const expressions = pilout.expressions.map(e => formatExpression(e, pilout, symbols, stark, saveSymbols, global));
    
    if(!saveSymbols) {
        return { expressions };
    } else {
        return { expressions, symbols};
    }
}

module.exports.formatHints = function formatHints(pilout, rawHints, symbols, expressions, stark, saveSymbols, global = false) {
    const hints = [];

    for(let i = 0; i < rawHints.length; ++i) {
        const hint = { name: rawHints[i].name };
        const fields = rawHints[i].hintFields[0].hintFieldArray.hintFields;
        hint.fields = [];
        for(let j = 0; j < fields.length; j++) {
            const name = fields[j].name;
            const {values, lengths} = processHintField(fields[j], pilout, symbols, expressions, stark, saveSymbols, global);
            if(!lengths) {
                hint.fields.push({name, values: [values], lengths});
            } else {
                hint.fields.push({name, values, lengths});
            }
        }
        hints.push(hint);
    }

    return hints;
}

function processHintField(hintField, pilout, symbols, expressions, stark, saveSymbols, global = false) {
    let resultFields = [];
    let lengths = [];
    if (hintField.hintFieldArray) {
        const fields = hintField.hintFieldArray.hintFields;
        for (let j = 0; j < fields.length; j++) {
            const { values, lengths: subLengths } = processHintField(fields[j], pilout, symbols, expressions, stark, saveSymbols, global);

            resultFields.push(values);

            if (lengths.length === 0) {
                lengths.push(fields.length);
            }
            
            if (subLengths && subLengths.length > 0) {
                for (let k = 0; k < subLengths.length; k++) {
                    if (lengths[k + 1] === undefined) {
                        lengths[k + 1] = subLengths[k];
                    }
                }
            }
        }
    } else {
        let value;

        if (hintField.operand) {
            value = formatExpression(hintField.operand, pilout, symbols, stark, saveSymbols, global);
            if (value.op === "exp") expressions[value.id].keep = true;
        } else if (hintField.stringValue) {
            value = { op: "string", string: hintField.stringValue };
        } else {
            throw new Error("Unknown hint field");
        }

        return { values: value };
    }

    return {values: resultFields, lengths };
}


function formatExpression(exp, pilout, symbols, stark, saveSymbols = false, global = false) {
    const P = new ProtoOut();
    
    if(exp.op) return exp;

    let op = Object.keys(exp)[0];
    
    let store = false;

    if(op === "expression") {
        const id = exp[op].idx;
        const expOp = Object.keys(pilout.expressions[id])[0];
        if(expOp != "mul" && Object.keys(pilout.expressions[id][expOp].lhs)[0] !== "expression" && Object.keys(pilout.expressions[id][expOp].rhs)[0] === "constant" && P.buf2bint(pilout.expressions[id][expOp].rhs.constant.value).toString() === "0") {
            return formatExpression(pilout.expressions[id][expOp].lhs, pilout, symbols, stark, saveSymbols, global);
        }
        exp = { op: "exp", id };
    } else if(["add", "mul", "sub"].includes(op)) {
        const lhs = formatExpression(exp[op].lhs, pilout, symbols, stark, saveSymbols, global);
        const rhs = formatExpression(exp[op].rhs, pilout, symbols, stark, saveSymbols, global);
        exp = { op, values: [lhs, rhs] };
    } else if(op === "neg") {
        const value = formatExpression(exp[op].value, pilout, symbols, stark, saveSymbols, global);
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
        const airgroupId = exp[op].airGroupId;
        const airId = exp[op].airId;
        exp = { op: "cm", id, stageId, rowOffset, stage, dim, airgroupId, airId };
        store = true;
    } else if (op === "fixedCol") {
        const id = exp[op].idx;
        const rowOffset = exp[op].rowOffset;
        const airgroupId = exp[op].airGroupId;
        const airId = exp[op].airId;
        exp = { op: "const", id, rowOffset, stage: 0, dim: 1, airgroupId, airId };
        store = true;
    } else if (op === "publicValue") {
        const id = exp[op].idx;
        exp = { op: "public", id, stage: 1 };
        store = true;
    } else if (op === "airGroupValue") {
        const id = exp[op].idx;
        const stage = !global ? pilout.airGroupValues[id].stage : pilout.airGroups[exp[op].airGroupId].airGroupValues[id].stage;
        exp = { op: "airgroupvalue", id, airgroupId: exp[op].airGroupId, dim: 3, stage };
        store = true;
    } else if (op === "airValue") {
        const id = exp[op].idx;
        const stage = pilout.airValues[id].stage;
        const dim = stage !== 1 && stark ? 3 : 1; 
        exp = { op: "airvalue", id, stage, dim };
        store = true;
    } else if (op === "challenge") {
        const id = exp[op].idx + pilout.numChallenges.slice(0, exp[op].stage - 1).reduce((acc, c) => acc + c, 0);
        const stageId = exp[op].idx;
        const stage = exp[op].stage;
        exp = { op: "challenge", stage, stageId, id };
        store = true;
    } else throw new Error("Unknown op: " + op);

    if(saveSymbols && store) {
        addSymbol(pilout, symbols, exp, stark, global);
    }

    return exp;
}

function addSymbol(pilout, symbols, exp, stark, global = false) {
    let airgroupId = exp.airGroupId || 0;
    let airId = exp.airId || 0;
    if(exp.op === "public") {
        const publicSymbol = symbols.find(s => s.type === "public" && s.id === exp.id);
        if(!publicSymbol) {
            const name = pilout.name + ".public_" + exp.id;
            symbols.push({type: "public", dim: 1, id: exp.id, name });
        }
    } else if(exp.op === "challenge") {
        const challengeSymbol = symbols.find(s => s.type === "challenge" && s.stage === exp.stage && s.stageId === exp.stageId);
        if(!challengeSymbol) {
            const dim = stark ? 3 : 1;
            const name = pilout.name + ".challenge_" + exp.stage + "_" + exp.stageId;
            const id = symbols.filter(si => si.type === "challenge" && ((si.stage < exp.stage) || (si.stage === exp.stage && si.stageId < exp.stageId))).length;
            symbols.push({ type: "challenge", stageId: exp.stageId, stage: exp.stage, id, dim, name});
        }
    } else if(exp.op === "const") {
        const fixedSymbol = symbols.find(s => s.type === "fixed" && s.airId === airId && s.airgroupId === airgroupId
            && s.stage === exp.stage && s.stageId === exp.id);
        if(!fixedSymbol) {
            const name = pilout.name + ".fixed_" + exp.id;
            symbols.push({ type: "fixed", polId: exp.id, stageId: exp.id, stage: exp.stage, dim: 1, name, airId, airgroupId});
        }
    } else if(exp.op === "cm") {
        const witnessSymbol = symbols.find(s => s.type === "witness" && s.airId === airId && s.airgroupId === airgroupId
            && s.stage === exp.stage && s.stageId === exp.stageId);
        if(!witnessSymbol) {
            const name = pilout.name + ".witness_" + exp.stage + "_" + exp.stageId;
            const dim = (exp.stage === 1 || !stark) ? 1 : 3;
            symbols.push({ type: "witness", polId: exp.id, stageId: exp.stageId, stage: exp.stage, dim, name, airId, airgroupId});
        }
    } else if(exp.op === "airgroupvalue") {
        const airgroupvalueSymbol = symbols.find(s => s.type === "airgroupvalue" && s.id === exp.id && s.airId === airId && s.airgroupId === airgroupId);
        if(!airgroupvalueSymbol) {
            const name = pilout.name + ".airgroupvalue_" + exp.id;
            const airgroupVal = {type: "airgroupvalue", id: exp.id, name, stage: pilout.airGroupValues[exp.id].stage, dim: 3 };
            if(!global) {
                airgroupVal.airId = airId;
                airgroupVal.airgroupId = airgroupId;
            }
            symbols.push(airgroupVal);
        }
    } else if(exp.op === "airvalue") {
        const airvalueSymbol = symbols.find(s => s.type === "airvalue" && s.id === exp.id && s.airId === airId && s.airgroupId === airgroupId);
        if(!airvalueSymbol) {
            const name = pilout.name + ".airvalue_" + exp.id;
            const dim = stage !== 1 && stark ? 3 : 1; 
            symbols.push({type: "airvalue", dim, id: exp.id, stage: exp.stage, name, airId, airgroupId });
        }
    } else {
        throw new Error ("Unknown operation " + exp.op);
    }
    return;
}

module.exports.printExpressions = function printExpressions(res, exp, expressions, isConstraint = false) {
    if(exp.op === "exp") {
        if(!exp.line) exp.line = printExpressions(res, expressions[exp.id], expressions, isConstraint);
        return exp.line;
    } else if(["add", "mul", "sub"].includes(exp.op)) {
        const lhs = printExpressions(res, exp.values[0], expressions, isConstraint);
        const rhs = printExpressions(res, exp.values[1], expressions, isConstraint);
        const op = exp.op === "add" ? " + " : exp.op === "sub" ? " - " : " * ";
        return "(" + lhs + op + rhs + ")";
    } else if(exp.op === "neg") {
        return printExpressions(res, exp.values[0], expressions, isConstraint);
    } else if (exp.op === "number") {
        return exp.value;
    } else if (exp.op === "const" || exp.op === "cm") {
        const col = exp.op === "const" ? res.constPolsMap[exp.id] : res.cmPolsMap[exp.id];
        if(col.imPol && !isConstraint) {
            return printExpressions(res, expressions[col.expId], expressions, false);
        }
        let name = col.name;
        if(col.lengths) name += col.lengths.map(len => `[${len}]`).join('');
        if(col.imPol) name += res.cmPolsMap.filter((w, i) => i < exp.id && w.imPol).length;
        if(exp.rowOffset) {
            if(exp.rowOffset > 0) {
                name += "'";
                if(exp.rowOffset > 1) name += exp.rowOffset;
            } else {
                name = "'" + name;
                if(exp.rowOffset < -1) name = Math.abs(exp.rowOffset) + name;
            }
        }
        return name;
    } else if (exp.op === "public") {
        return res.publicsMap[exp.id].name;
    } else if (exp.op === "airvalue") {
        return res.airValuesMap[exp.id].name;    
    } else if (exp.op === "airgroupvalue") {
        return res.airgroupValuesMap[exp.id].name; 
    } else if (exp.op === "challenge") {
        return res.challengesMap[exp.id].name;
    } else if (exp.op === "x") {
        return "x";
    } else if (exp.op === "Zi") {
        return "zh";
    } else throw new Error("Unknown op: " + exp.op);
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

module.exports.formatSymbols = function formatSymbols(pilout, stark, global = false) {
    const E = new ExpressionOps();

    const symbols = pilout.symbols.flatMap(s => {
        if([piloutTypes.FIXED_COL, piloutTypes.WITNESS_COL].includes(s.type)) {
            const dim = ([0,1].includes(s.stage) || !stark) ? 1 : 3;
            const type = s.type === piloutTypes.FIXED_COL ? "fixed" : "witness";
            const previousPols = pilout.symbols.filter(si => si.type === s.type 
                && si.airId === s.airId && si.airGroupId === s.airGroupId
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
                    airgroupId: s.airGroupId,
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
        } else if(s.type === piloutTypes.AIRGROUP_VALUE) {
            const airgroupValue = {
                name: s.name,
                type: "airgroupvalue",
                id: s.id,
                airgroupId: s.airGroupId,
                dim: stark ? 3 : 1,
            }
            if(!global) airgroupValue.stage = pilout.airGroupValues[s.id].stage;
            return airgroupValue;
        } else if(s.type === piloutTypes.AIR_VALUE) {
            const airvalue = {
                name: s.name,
                type: "airvalue",
                id: s.id,
                airgroupId: s.airGroupId,
            }
            if(!global) {
                airvalue.stage = pilout.airValues[s.id].stage;
                airvalue.dim = stark && airvalue.stage != 1 ? 3 : 1;
            }
            return airvalue;
        }
    });

    return symbols;
}

function generateMultiArraySymbols(E, symbols, indexes, sym, type, dim, polId, shift) {
    if (indexes.length === sym.lengths.length) {
        E.cm(polId + shift, 0, sym.stage, dim);
        symbols.push({
            name: sym.name,
            lengths: indexes,
            idx: shift,
            stage: sym.stage,
            type,
            polId: polId + shift,
            stageId: sym.id + shift,
            dim,
            airId: sym.airId,
            airgroupId: sym.airGroupId,
        });
        return shift + 1;
    }

    for (let i = 0; i < sym.lengths[indexes.length]; i++) {
        shift = generateMultiArraySymbols(E, symbols, [...indexes, i], sym, type, dim, polId, shift);
    }

    return shift;
}
