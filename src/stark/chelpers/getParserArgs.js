const { assert } = require("chai");
const { getIdMaps } = require("./helpers");
const { getOperation } = require("./generateParser");

const operationsTypeMap = {
    "add": 0,
    "sub": 1,
    "mul": 2,
    "sub_swap": 3,
}

module.exports.getParserArgs = function getParserArgs(starkInfo, operations, code, numbers = [], global = false, verify = false, debug = false) {

    var ops = [];
    var args = [];

    var counters_ops = new Array(operations.length).fill(0);

    let code_ = code.code;

    let symbolsUsed = code.symbolsUsed;

    // Evaluate max and min temporal variable for tmp_ and tmp3_
    let maxid = 100000;
    let ID1D = new Array(maxid).fill(-1);
    let ID3D = new Array(maxid).fill(-1);
    let { count1d, count3d } = getIdMaps(maxid, ID1D, ID3D, code_);
        
    for (let j = 0; j < code_.length; j++) {
        const r = code_[j];
        
        let operation = getOperation(r, verify);

        if(operation.op !== "copy") args.push(operationsTypeMap[operation.op]);

        pushResArg(r, r.dest.type, verify);
        for(let i = 0; i < operation.src.length; i++) {
            pushSrcArg(operation.src[i], operation.src[i].type, verify);
        }

        let opsIndex = operations.findIndex(op => !op.op && op.dest_type === operation.dest_type && op.src0_type === operation.src0_type && op.src1_type === operation.src1_type);
        if (opsIndex === -1) throw new Error("Operation not considered: " + JSON.stringify(operation));

        ops.push(opsIndex);

        counters_ops[opsIndex] += 1;
    }

   

    const expsInfo = {
        nTemp1: count1d,
        nTemp3: count3d,
        ops,
        args,
    }

    if(symbolsUsed) {
        expsInfo.constPolsIds = symbolsUsed.filter(s => s.op === "const").map(s => s.id).sort();
        expsInfo.cmPolsIds = symbolsUsed.filter(s => s.op === "cm").map(s => s.id).sort();
        expsInfo.challengeIds = symbolsUsed.filter(s => s.op === "challenge").map(s => s.id).sort();
        expsInfo.publicsIds = symbolsUsed.filter(s => s.op === "public").map(s => s.id).sort();
        expsInfo.airgroupValuesIds = symbolsUsed.filter(s => s.op === "airgroupvalue").map(s => s.id).sort();
        expsInfo.airValuesIds = symbolsUsed.filter(s => s.op === "airvalue").map(s => s.id).sort();

    }

    const destTmp = code_[code_.length - 1].dest;
    if(destTmp.dim == 1) {
        expsInfo.destDim = 1;
        expsInfo.destId = ID1D[destTmp.id];
    } else if(destTmp.dim == 3) {
        expsInfo.destDim = 3;
        expsInfo.destId = ID3D[destTmp.id];
    } else throw new Error("Unknown");
    
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

    function pushResArg(r, type, verify) {
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
            case "cm": {
                evalMap_(r.dest.id, r.dest.prime, verify)
                break;
            }
            default: throw new Error("Invalid reference type set: " + r.dest.type);
        }
    }


    function pushSrcArg(r, type, verify) {
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
                const primeIndex = starkInfo.openingPoints.findIndex(p => p === r.prime);
                if(primeIndex == -1) throw new Error("Something went wrong");

               
                if(verify) {
                    args.push(0);
                } else {
                    args.push((starkInfo.nStages + 2)*primeIndex);
                }
                args.push(r.id);
                
                
                break;
            }
            case "cm": {
                evalMap_(r.id, r.prime, verify)
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
            case "public":
            case "eval": 
            case "proofvalue":
            case "airvalue":
            case "challenge": {
                args.push(r.id);
                break;
            }
            case "airgroupvalue": {
                if(!global) {
                    args.push(r.id);
                } else {
                    args.push(r.airgroupId);
                    args.push(r.id);
                }
                break;
            }
            case "xDivXSubXi":
                if(verify) {
                    args.push((starkInfo.nStages + 2));
                    args.push(3*r.id);
                } else {
                    args.push((starkInfo.nStages + 2)*starkInfo.openingPoints.length);
                    args.push(3*r.id);
                }
                break;
            case "Zi": {
                if(verify) {
                    args.push((starkInfo.nStages + 2));
                    args.push(3 + 3*r.boundaryId);
                } else {
                    args.push((starkInfo.nStages + 2)*starkInfo.openingPoints.length);
                    args.push(1 + r.boundaryId);
                }
                break;
            }
            case "x": {
                if(verify) {
                    args.push(starkInfo.nStages + 2);
                    args.push(0);
                } else {
                    args.push((starkInfo.nStages + 2)*starkInfo.openingPoints.length);
                    args.push(0);
                }
                break;
            }
        }
    }

    function evalMap_(polId, prime, verify) {
        let p = starkInfo.cmPolsMap[polId];

        const stage = p.stage;
        
        const primeIndex = starkInfo.openingPoints.findIndex(p => p === prime);
        if(primeIndex == -1) throw new Error("Something went wrong");
        
       
        if(verify) {
            args.push(stage);
        } else {
            args.push((starkInfo.nStages + 2)*primeIndex + stage);
        }
        args.push(Number(p.stagePos));
    }
}
