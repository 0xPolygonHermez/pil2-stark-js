const ExpressionOps = require("../expressionops");

module.exports.getPiloutInfo = function getPiloutInfo(res, pilout) {
    const E = new ExpressionOps();

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

    const symbols = pilout.symbols.map(s => {
        E.cm(s.id, 0, 1);
        return {
            name: s.name,
            stage: s.stage,
            type: s.type === 1 ? "fixed" : s.type === 3 ? "witness" : undefined,
            polId: s.id,
        }
    });

    res.nCommitments = symbols.filter(s => s.type === "witness").length;

    const expressions = pilout.expressions;
    for(let i = 0; i < expressions.length; ++i) {
        expressions[i] = formatExpression(expressions, expressions[i]);
    }

    const publics = [];

    return {expressions, constraints, symbols, publics};
}


function formatExpression(expressions, exp) {
    if(exp.op) return exp;

    let op = Object.keys(exp)[0];

    if(op === "expression") {
        exp = {
            op: "exp",
            id: exp[op].idx,
            rowOffset: exp[op].rowOffset || 0,
        }
    } else if(["add", "mul", "sub"].includes(op)) {
        const lhs = exp[op].lhs;
        const rhs = exp[op].rhs;
        exp = {
            op: op,
            values: [
                formatExpression(expressions, lhs),
                formatExpression(expressions, rhs),
            ]
        }
    } else if (op === "constant") {
        exp = {
            op: "number",
            value: "1",
        }
    } else if (op === "witnessCol") {
        exp = {
            op: "cm",
            id: exp[op].colIdx,
            rowOffset: exp[op].rowOffset, 
        }
    } else if (op === "fixedCol") {
        exp = {
            op: "const",
            id: exp[op].idx,
            rowOffset: exp[op].rowOffset, 
        }
    } else throw new Error("Unknown op: " + op);

    return exp;
}
