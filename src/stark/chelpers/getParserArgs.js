const { assert } = require("chai");
const { getIdMaps } = require("./helpers");
const { getOperation } = require("./generateParser");

const operationsTypeMap = {
    "add": 0,
    "sub": 1,
    "mul": 2,
    "sub_swap": 3,
}

module.exports.getParserArgs = function getParserArgs(starkInfo, operations, code, dom) {

    var ops = [];
    var args = [];
    var numbers = [];

    var counters_ops = new Array(operations.length).fill(0);

    const nBits = starkInfo.starkStruct.nBits;
    const nBitsExt = starkInfo.starkStruct.nBitsExt;

    const next = (dom == "n" ? 1 : 1 << (nBitsExt - nBits));

    // Evaluate max and min temporal variable for tmp_ and tmp3_
    let maxid = 100000;
    let ID1D = new Array(maxid).fill(-1);
    let ID3D = new Array(maxid).fill(-1);
    let { count1d, count3d } = getIdMaps(maxid, ID1D, ID3D, code);
        
    for (let j = 0; j < code.length; j++) {
        const r = code[j];
        
        let operation = getOperation(r);

        if(operation.op !== "copy" && "q" !== operation.dest_type) {
            args.push(operationsTypeMap[operation.op]);
        }

        pushResArg(r, r.dest.type);
        for(let i = 0; i < r.src.length; i++) {
            pushSrcArg(r.src[i], r.src[i].type);
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

    const expsInfo = {
        nTemp1: count1d,
        nTemp3: count3d,
        ops,
        numbers,
        args,
    }
    
    const opsUsed = counters_ops.reduce((acc, currentValue, currentIndex) => {
        if (currentValue !== 0) {
          acc.push(currentIndex);
        }
        return acc;
    }, []);

    console.log("Number of operations: ", ops.length);
    console.log("Number of arguments: ", args.length);
    console.log("Different operations types: ", opsUsed.length, " of ", operations.length);
    console.log("Operations used: ", opsUsed.join(", "));

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
            case "tmpExp": {
                if (dom == "n") {
                    evalMap_(r.dest.id, r.dest.prime)
                } else if (dom == "ext") {
                    throw new Error("Invalid dom");
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
                args.push(r.prime);
                
                break;
            }
            case "tmpExp": {
                if (dom == "n") {
                    evalMap_(r.id, r.prime)
                } else if (dom == "ext") {
                    throw new Error("Invalid dom");
                } else {
                    throw new Error("Invalid dom");
                }
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
            case "q": {
                if (dom == "n") {
                    throw new Error("Accessing q in domain n");
                } else if (dom == "ext") {
                    evalMap_(starkInfo.qs[r.id], r.prime)
                } else {
                    throw new Error("Invalid dom");
                }
                break;
            }
            case "number": {
                let numString = `${BigInt(r.value).toString()}`;
                if(!numbers.includes(numString)) numbers.push(numString); 
                args.push(numbers.indexOf(numString));
                break;
            }
            case "xDivXSubXi": {
                args.push(r.id);
                break;
            }
            case "public":
            case "subproofValue":
            case "eval": 
            {
                args.push(r.id);
                break;
            }
            case "challenge":
            {
                const globalId = starkInfo.numChallenges.slice(0, r.stage - 1).reduce((acc, c) => acc + c, 0) + r.id;
                args.push(globalId);
                break;
            
            }
        }
    }

    function evalMap_(polId, prime) {
        let p = starkInfo.cmPolsMap[polId];

        args.push(Number(p.stageNum));
        args.push(Number(p.stagePos));
        args.push(Number(prime));
    }
}