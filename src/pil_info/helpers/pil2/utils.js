const ProtoOut = require("pilcom2/src/proto_out.js");
const ExpressionOps = require("../../expressionops");

module.exports.formatExpressions = function formatExpressions(pilout, stark, saveSymbols = false) {
    const P = new ProtoOut();

    const symbols = [];

    const expressions = pilout.expressions.map(e => formatExpression(e));
    
    if(!saveSymbols) {
        return { expressions };
    } else {
        return { expressions, symbols};
    }

    function formatExpression(exp) {    
        if(exp.op) return exp;

        let op = Object.keys(exp)[0];
    
        if(op === "expression") {
            const id = exp[op].idx;
            exp = { op: "exp", id };
        } else if(["add", "mul", "sub"].includes(op)) {
            const lhs = formatExpression(exp[op].lhs);
            const rhs = formatExpression(exp[op].rhs);
            exp = { op, values: [lhs, rhs] };
        } else if(["neg"].includes(op)) {
            const value = formatExpression(exp[op].value);
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
            exp = { op: "cm", id, stageId, rowOffset, stage, dim };
        } else if (op === "fixedCol") {
            const id = exp[op].idx;
            const rowOffset = exp[op].rowOffset;
            exp = { op: "const", id, rowOffset, stage: 0, dim: 1 };
        } else if (op === "publicValue") {
            const id = exp[op].idx;
            exp = { op: "public", id };
        } else if (op === "challenge") {
            const id = exp[op].idx + pilout.numChallenges.slice(0, exp[op].stage - 1).reduce((acc, c) => acc + c, 0);
            const stageId = exp[op].idx;
            const stage = exp[op].stage;
            exp = { op: "challenge", stage, stageId, id };
        } else throw new Error("Unknown op: " + op);
    
        if(saveSymbols) {
            addSymbol(symbols, exp, stark);
        }

        return exp;
    }
}

function addSymbol(symbols, exp, stark) {
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
            symbols.push({ type: "challenge", stageId: exp.stageId, stage: exp.stage, dim, name});
        }
    } else if(exp.op === "const") {
        const fixedSymbol = symbols.find(s => s.type === "fixed" && s.stage === exp.stage && s.stageId === exp.stageId);
        if(!fixedSymbol) {
            const name = "fixed_" + exp.stageId;
            symbols.push({ type: "fixed", polId: exp.stageId, stageId: exp.stageId, stage: exp.stage, dim: 1, name});
        }
    } else if(exp.op === "cm") {
        const witnessSymbol = symbols.find(s => s.type === "witness" && s.stage === exp.stage && s.stageId === exp.stageId);
        if(!witnessSymbol) {
            const name = "witness_" + exp.stage + "_" + exp.stageId;
            const dim = (exp.stage === 1 || !stark) ? 1 : 3;
            symbols.push({ type: "witness", polId: exp.id, stageId: exp.stageId, stage: exp.stage, dim, name});
        }
    }
    return;
}


module.exports.formatConstraints = function formatConstraints(pilout) {
    const constraints = pilout.constraints.map(c => {
        let boundary = Object.keys(c)[0];
        let constraint = {
            boundary,
            e: c[boundary].expressionIdx.idx,
            debugLine: c[boundary].debugLine,
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
        if([1, 3].includes(s.type)) {
            const dim = ([0,1].includes(s.stage) || !stark) ? 1 : 3;
            const type = s.type === 1 ? "fixed" : "witness";
            const previousPols = pilout.symbols.filter(si => si.type === s.type && ((si.stage < s.stage) || (si.stage === s.stage && si.id < s.id)));
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
                    dim
                }  
            } else {
                const multiArraySymbols = [];
                generateMultiArraySymbols(E, multiArraySymbols, [], s, dim, polId, 0);
                return multiArraySymbols;
            }
        } else if(s.type === 8) {
            return {
                name: s.name,
                type: "challenge",
                stageId: s.id,
                stage: s.stage,
                dim: stark ? 3 : 1,
            }
        } else if(s.type === 6) {
            return {
                name: s.name,
                type: "public",
                dim: 1,
                id: s.id,
            }
        }
    }); 

    return symbols;
}

function generateMultiArraySymbols(E, symbols, indexes, sym, dim, polId, shift) {
    if (indexes.length === sym.lengths.length) {
        const type = sym.type === 1 ? "fixed" : "witness";
        E.cm(polId + shift, 0, sym.stage, dim);
        symbols.push({
            name: sym.name,
            stage: sym.stage,
            type,
            polId: polId + shift,
            stageId: sym.id + shift,
            dim,
        });
        return shift + 1;
    }

    for (let i = 0; i < sym.lengths[indexes.length]; i++) {
        shift = generateMultiArraySymbols(E, symbols, [...indexes, i], sym, dim, polId, shift);
    }

    return shift;
}
