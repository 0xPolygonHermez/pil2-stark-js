const ExpressionOps = require("../expressionops");
const ProtoOut = require("pilcom2/src/proto_out.js");
const { newConstantPolsArrayPil2 } = require("pilcom/src/polsarray");

module.exports.getPiloutInfo = function getPiloutInfo(res, pilout, stark) {
    const E = new ExpressionOps();

    const numChallenges = pilout.symbols.filter(s => s.type === 8).reduce((acc, s) => {
        if(!acc[s.stage - 2]) acc[s.stage - 2] = 0;
        acc[s.stage - 2]++;
        return acc; 
    },[]);

    res.nLibStages = numChallenges.length;

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
        if([1, 3].includes(s.type)) {
            const dim = [0,1].includes(s.stage) ? 1 : stark ? 3 : 1;
            const type = s.type === 1 ? "fixed" : "witness";
            const polId = pilout.symbols.filter(si => si.type === 3 && ((si.stage < s.stage) || (si.stage === s.stage && si.id < s.id))).length;
            E.cm(polId, 0, s.stage, dim);
            return {
                name: s.name,
                stage: s.stage,
                type,
                polId: polId,
                stageId: s.id,
                dim
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
    
    res.nCommitments = symbols.filter(s => s.type === "witness").length;
    res.nConstants = symbols.filter(s => s.type === "fixed").length;
    res.nPublics = symbols.filter(s => s.type === "public").length;

    const expressions = pilout.expressions;
    for(let i = 0; i < expressions.length; ++i) {
        expressions[i] = formatExpression(symbols, expressions, expressions[i]);
    }

    const publicsInfo = [];

    const hints = [];

    return {expressions, hints, constraints, symbols, publicsInfo};
}


function formatExpression(symbols, expressions, exp) {
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
                formatExpression(symbols, expressions, lhs),
                formatExpression(symbols, expressions, rhs),
            ]
        }
    } else if (op === "constant") {
        exp = {
            op: "number",
            value: P.buf2bint(exp.constant.value).toString(),
        }
    } else if (op === "witnessCol") {
        const witnessCol = symbols.find(s => s.type === "witness" && s.stage === exp[op].stage && s.stageId === exp[op].colIdx);
        exp = {
            op: "cm",
            id: witnessCol.polId,
            rowOffset: exp[op].rowOffset,
            dim: witnessCol.dim, 
            stage: witnessCol.stage,
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
        exp = {
            op: "challenge",
            stage: exp[op].stage, 
            id: symbols.filter(s => s.type === "challenge" && ((s.stage < exp[op].stage) || (s.stage === exp[op].stage && s.stageId < exp[op].idx))).length,
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
    