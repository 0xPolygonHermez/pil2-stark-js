const { buildCode, pilCodeGen, fixProverCode } = require("../code/codegen.js");


module.exports  = function generateConstraintPolynomialVerifierCode(res, cExpId, symbols, expressions, constraints, stark) {       
    let ctx = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

    res.evMap = [];

    for(let i = 0; i < symbols.length; i++) {
        if(!symbols[i].imPol) continue;
        const expId = symbols[i].expId;
        ctx.calculated[expId] = {};
        for(let i = 0; i < res.openingPoints.length; ++i) {
            const openingPoint = res.openingPoints[i];
            ctx.calculated[expId][openingPoint] = true;
        }
    }

    let addMul = stark && res.starkStruct.verificationHashType == "GL" ? false : true;
    pilCodeGen(ctx, expressions, constraints, cExpId, 0, addMul);

    res.code.qVerifier = buildCode(ctx, res, symbols, expressions, "n", stark, true);

    if (stark) {
        for (let i = 0; i < res.qDeg; i++) {
            const rf = { type: "cm", id: res.qs[i], name: "Q" + i, prime: 0 };
            res.evMap.push(rf);
        }
    } else {
        let nOpenings = {};
        for(let i = 0; i < res.evMap.length; ++i) {
            if(res.evMap[i].type === "const") continue;
            const name = res.evMap[i].type + res.evMap[i].id;
            if(!nOpenings[name]) nOpenings[name] = 1;
            ++nOpenings[name];
        }   

        res.maxPolsOpenings = Math.max(...Object.values(nOpenings));

        res.nBitsZK = Math.ceil(Math.log2((res.pilPower + res.maxPolsOpenings) / res.pilPower));
    }
}
