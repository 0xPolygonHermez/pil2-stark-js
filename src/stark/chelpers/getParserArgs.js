const { assert } = require("chai");
const { getIdMaps } = require("./helpers");
const { getOperation } = require("./generateParser");

const operationsTypeMap = {
    "add": 0,
    "sub": 1,
    "mul": 2,
    "sub_swap": 3,
}

module.exports.getParserArgs = function getParserArgs(starkInfo, operations, code, dom, debug = false) {

    var ops = [];
    var args = [];
    var numbers = [];

    var counters_ops = new Array(operations.length).fill(0);

    let code_ = code.code;

    let symbolsUsed = code.symbolsUsed;
    let symbolsCalculated = code.symbolsCalculated;

    // Evaluate max and min temporal variable for tmp_ and tmp3_
    let maxid = 100000;
    let ID1D = new Array(maxid).fill(-1);
    let ID3D = new Array(maxid).fill(-1);
    let { count1d, count3d } = getIdMaps(maxid, ID1D, ID3D, code_);
        
    for (let j = 0; j < code_.length; j++) {
        const r = code_[j];
        
        let operation = getOperation(r);

        if(operation.op !== "copy" && "q" !== operation.dest_type) {
            args.push(operationsTypeMap[operation.op]);
        }

        pushResArg(r, r.dest.type);
        for(let i = 0; i < operation.src.length; i++) {
            pushSrcArg(operation.src[i], operation.src[i].type);
        }

        
        let opsIndex;
        if(r.op === "copy") {
            opsIndex = operations.findIndex(op => op.dest_type === operation.dest_type && op.src0_type === operation.src0_type && !op.src1_type);
        } else if(operation.op === "mul" && ["tmp3", "commit3"].includes(operation.dest_type) && operation.src1_type === "challenge") {
            opsIndex = operations.findIndex(op => op.op === operation.op && op.dest_type === operation.dest_type && op.src0_type === operation.src0_type && op.src1_type === operation.src1_type);
        } else {
            opsIndex = operations.findIndex(op => !op.op && op.dest_type === operation.dest_type && op.src0_type === operation.src0_type && op.src1_type === operation.src1_type);
        }
        
        if (opsIndex === -1) throw new Error("Operation not considered: " + JSON.stringify(operation));

        ops.push(opsIndex);

        counters_ops[opsIndex] += 1;
    }

    const constPolsIds = symbolsUsed.filter(s => s.op === "const").map(s => s.id).sort();
    const cmPolsIds = symbolsUsed.filter(s => s.op === "cm" || s.op === "tmp").map(s => s.id).sort();
    const challengeIds = symbolsUsed.filter(s => s.op === "challenge").map(s => s.id).sort();
    const publicsIds = symbolsUsed.filter(s => s.op === "public").map(s => s.id).sort();
    const subproofValuesIds = symbolsUsed.filter(s => s.op === "subproofValue").map(s => s.id).sort();

    const cmPolsCalculatedIds = symbolsCalculated.map(s => s.id).sort();


    const expsInfo = {
        nTemp1: count1d,
        nTemp3: count3d,
        ops,
        numbers,
        args,
        cmPolsIds,
        constPolsIds,
        challengeIds,
        publicsIds,
        subproofValuesIds,
        cmPolsCalculatedIds
    }

    if(debug) {
        const destTmp = code_[code_.length - 1].dest;
        if(destTmp.type !== "tmp") {
            expsInfo.destDim = destTmp.dim;
            expsInfo.destId = 0;
        } else if(destTmp.dim == 1) {
            expsInfo.destDim = 1;
            expsInfo.destId = ID1D[destTmp.id];
        } else if(destTmp.dim == 3) {
            expsInfo.destDim = 3;
            expsInfo.destId = ID3D[destTmp.id];
        }
    }
    
    const opsUsed = counters_ops.reduce((acc, currentValue, currentIndex) => {
        if (currentValue !== 0) {
          acc.push(currentIndex);
        }
        return acc;
    }, []);

    // console.log("Number of operations: ", ops.length);
    // console.log("Number of arguments: ", args.length);
    // console.log("Different operations types: ", opsUsed.length, " of ", operations.length);
    // console.log("Operations used: ", opsUsed.join(", "));

    return {expsInfo, opsUsed};

    function pushResArg(r, type) {
        switch (type) {
            case "tmp": {
                if (r.dest.dim == 1) {
                    args.push(ID1D[r.dest.id]);
                } else {
                    assert(r.dest.dim == 3);
                    args.push(ID3D[r.dest.id]);
                }
                break;
            }
            case "q": {
                break;
            }
            case "cm": {
                if (dom == "n") {
                    evalMap_(r.dest.id, r.dest.prime)
                } else if (dom == "ext") {
                    evalMap_(r.dest.id, r.dest.prime)
                } else {
                    throw new Error("Invalid dom");
                }
                break;
            }
            case "f": {
                break;
            }
            default: throw new Error("Invalid reference type set: " + r.dest.type);
        }
    }


    function pushSrcArg(r, type) {
        switch (type) {
            case "tmp": {
                if (r.dim == 1) {
                    args.push(ID1D[r.id]);
                } else {
                    assert(r.dim == 3);
                    args.push(ID3D[r.id]);
                }
                break;
            }
            case "const": {

                args.push(0);
                args.push(r.id);

                const primeIndex = starkInfo.openingPoints.findIndex(p => p === r.prime);
                if(primeIndex == -1) throw new Error("Something went wrong");

                args.push(primeIndex);
                
                break;
            }
            case "cm": {
                if (dom == "n") {
                    evalMap_(r.id, r.prime)
                } else if (dom == "ext") {
                    evalMap_(r.id, r.prime)
                } else {
                    throw new Error("Invalid dom");
                }
                break;
            }
            case "number": {
                let num = BigInt(r.value);
                if(num < 0n) num += BigInt(0xFFFFFFFF00000001n);
                let numString = `${num.toString()}`;
                if(!numbers.includes(numString)) numbers.push(numString); 
                args.push(numbers.indexOf(numString));
                break;
            }
            case "xDivXSubXi":
            case "public":
            case "subproofValue":
            case "eval": 
            case "challenge": {
                args.push(r.id);
                break;
            }
            case "Zi": {
                args.push(r.boundaryId);
                break;
            }
        }
    }

    function evalMap_(polId, prime) {
        let p = starkInfo.cmPolsMap[polId];

        const stage = p.stage;
        
        const primeIndex = starkInfo.openingPoints.findIndex(p => p === prime);
        if(primeIndex == -1) throw new Error("Something went wrong");

        args.push(Number(stage));
        args.push(Number(p.stagePos));
        args.push(Number(primeIndex));
    }
}