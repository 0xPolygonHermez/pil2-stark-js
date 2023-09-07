const ProtoOut = require("pilcom2/src/proto_out.js");
const ExpressionOps = require("../../expressionops");

module.exports.formatExpressions = function formatExpressions(pilout, stark) {
    const P = new ProtoOut();

    const expressions = pilout.expressions.map(e => formatExpression(e));
    return expressions;

    function formatExpression(exp) {    
        if(exp.op) return exp;
    
        let op = Object.keys(exp)[0];
    
        if(op === "expression") {
            exp = {
                op: "exp",
                id: exp[op].idx,
            }
        } else if(["add", "mul", "sub"].includes(op)) {
            const lhs = exp[op].lhs;
            const rhs = exp[op].rhs;
            exp = {
                op: op,
                values: [
                    formatExpression(lhs),
                    formatExpression(rhs),
                ]
            }
        } else if (op === "constant") {
            exp = {
                op: "number",
                value: P.buf2bint(exp.constant.value).toString(),
            }
        } else if (op === "witnessCol") {
            const id =  exp[op].colIdx + pilout.stageWidths.slice(0, exp[op].stage - 1).reduce((acc, c) => acc + c, 0);
            const dim = exp[op].stage === 1 ? 1 : stark ? 3 : 1;
            exp = {
                op: "cm",
                id,
                stageId: exp[op].colIdx,
                rowOffset: exp[op].rowOffset,
                stage: exp[op].stage,
                dim, 
            }
        } else if (op === "fixedCol") {
            exp = {
                op: "const",
                id: exp[op].idx,
                rowOffset: exp[op].rowOffset,
                stage: 0,
                dim: 1, 
            }
        } else if (op === "publicValue") {
            exp = {
                op: "public",
                id: exp[op].idx,
            }
        } else if (op === "challenge") {
            const id = exp[op].idx + pilout.numChallenges.slice(0, exp[op].stage - 1).reduce((acc, c) => acc + c, 0);
            exp = {
                op: "challenge",
                stage: exp[op].stage, 
                stageId: exp[op].idx,
                id,
            }
        } else throw new Error("Unknown op: " + op);
    
        return exp;
    }
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
            const dim = [0,1].includes(s.stage) ? 1 : stark ? 3 : 1;
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
