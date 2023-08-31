const { iterateCode, buildCode, pilCodeGen } = require("../code/codegen.js");


module.exports  = function generateConstraintPolynomialVerifierCode(res, symbols, expressions, constraints, stark) {       
    let ctx = {
        calculated: {},
        tmpUsed: 0,
        code: []
    };

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
    pilCodeGen(ctx, expressions, constraints, res.cExp, 0, addMul);

    res.code.qVerifier = buildCode(ctx, expressions);

    res.evMap = [];

    iterateCode(res.code.qVerifier, "n", res.openingPoints.length, fixRef);

    if (stark) {
        for (let i = 0; i < res.qDeg; i++) {
            const rf = {
                type: "cm",
                id: res.qs[i],
                name: "Q" + i,
                prime: 0,
            };
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

    function fixRef(r, ctx) {
        const p = r.prime || 0;
        switch (r.type) {
            // Check the expressions ids. If it is an intermediate polynomial
            // modify the type and set it as a commit;
            case "exp":
                let symbol = symbols.find(s => s.type === "tmpPol" && s.expId === r.id);
                if(symbol && symbol.imPol) {
                    r.type = "cm";
                    r.id = symbol.polId;
                } else {
                    if (typeof ctx.expMap[p][r.id] === "undefined") {
                        ctx.expMap[p][r.id] = ctx.code.tmpUsed ++;
                    }
                    r.type= "tmp";
                    r.expId = r.id;
                    r.id= ctx.expMap[p][r.id];
                    break;
                }
            case "cm":
            case "const":
		        let evalIndex = res.evMap.findIndex(e => e.type === r.type && e.id === r.id && e.prime === p);
                if (evalIndex == -1) {
                    const rf = {
                        type: r.type,
                        name: r.type === "cm" ? res.cmPolsMap[r.id].name : res.constPolsMap[r.id].name,
                        id: r.id,
                        prime: p
                    };
                    res.evMap.push(rf);
                    evalIndex = res.evMap.length - 1;
                }
                delete r.prime;
                r.id = evalIndex;
                r.type = "eval";
                break;
            case "number":
            case "challenge":
            case "public":
            case "tmp":
            case "Zi": 
            case "x":
            case "eval":
                    break;
            default:
                throw new Error("Invalid reference type: "+r.type);
        }
    }
}