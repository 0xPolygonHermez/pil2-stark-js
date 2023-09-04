const ExpressionOps = require("../expressionops");
const ProtoOut = require("pilcom2/src/proto_out.js");
const { newConstantPolsArrayPil2 } = require("pilcom/src/polsarray");

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
        E.cm(s.id, 0, s.stage);
        return {
            name: s.name,
            stage: s.stage,
            type: s.type === 1 ? "fixed" : s.type === 3 ? "witness" : undefined,
            polId: s.id,
            dim: s.dim || 1,
        }
    });

    res.nCommitments = symbols.filter(s => s.type === "witness").length;
    res.nConstants = symbols.filter(s => s.type === "fixed").length;
    res.nPublics = 0;

    const expressions = pilout.expressions;
    for(let i = 0; i < expressions.length; ++i) {
        expressions[i] = formatExpression(expressions, expressions[i]);
    }

    const publics = [];

    const hints = [];

    return {expressions, hints, constraints, symbols, publics};
}


function formatExpression(expressions, exp) {
    const P = new ProtoOut();

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
                formatExpression(expressions, lhs),
                formatExpression(expressions, rhs),
            ]
        }
    } else if (op === "constant") {
        exp = {
            op: "number",
            value: P.buf2bint(exp.constant.value).toString(),
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

module.exports.getFixedPolsPil2 = function getFixedPolsPil2(pil, F) {

    const cnstPols = newConstantPolsArrayPil2(pil.symbols, pil.numRows, F);
        
    const P = new ProtoOut();

    for(let i = 0; i < cnstPols.$$defArray.length; ++i) {
        const def = cnstPols.$$defArray[i];
        const name = def.name;
        const [nameSpace, namePol] = name.split(".");
        const deg = def.polDeg;
        const fixedCols = pil.fixedCols[i];
        for(let j = 0; j < deg; ++j) {
            if(def.idx) {
                cnstPols[nameSpace][namePol][def.idx][j] = P.buf2bint(fixedCols.values[j]);
            } else {
                cnstPols[nameSpace][namePol][j] = P.buf2bint(fixedCols.values[j]);
            }
        }
    }

    return cnstPols;
}
    