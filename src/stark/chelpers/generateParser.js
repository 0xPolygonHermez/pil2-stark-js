const { writeType, getAllOperations, numberOfArgs } = require("./utils");

const operationsMap = {
    "commit1": 1,
    "Zi": 2,
    "const": 3,
    "tmp1": 4,
    "public": 5,
    "number": 6,
    "commit3": 7,
    "xDivXSubXi": 8,
    "tmp3": 9,
    "subproofValue": 10,
    "challenge": 11, 
    "eval": 12,
}

module.exports.generateParser = function generateParser() {

    let operations = getAllOperations();

    let c_args = 0;
    
    const parserCPP = [];

    parserCPP.push(...[
        "uint64_t nrowsPack = 4;",
        "uint64_t nCols;",
        "vector<uint64_t> nColsStages;",
        "vector<uint64_t> nColsStagesAcc;",
        "vector<uint64_t> offsetsStages;",
        "vector<uint64_t> buffTOffsetsStages;\n",
    ]);

    parserCPP.push(`CHelpersSteps(StarkInfo& _starkInfo, CHelpers& _cHelpers, ConstPols& _constPols) : ExpressionsBuilder(_starkInfo, _cHelpers, _constPols) {};\n`);

    parserCPP.push(...[
        `inline void loadPolynomials(ParserArgs &parserArgs, ParserParams &parserParams, __m256i *bufferT_, uint64_t row, bool domainExtended) {`,
        "    uint64_t nOpenings = starkInfo.openingPoints.size();",
        "    uint64_t domainSize = domainExtended ? 1 << starkInfo.starkStruct.nBitsExt : 1 << starkInfo.starkStruct.nBits;\n",
        "    uint64_t extendBits = (starkInfo.starkStruct.nBitsExt - starkInfo.starkStruct.nBits);",
        "    int64_t extend = domainExtended ? (1 << extendBits) : 1;",
        "    uint64_t nextStrides[nOpenings];",
        "    for(uint64_t i = 0; i < nOpenings; ++i) {",
        "        uint64_t opening = starkInfo.openingPoints[i] < 0 ? starkInfo.openingPoints[i] + domainSize : starkInfo.openingPoints[i];",
        "        nextStrides[i] = opening * extend;",
        "    }\n",
        "    Goldilocks::Element *constPols = domainExtended ? params.constPolsExtended : params.constPols;\n",
        "    uint16_t* cmPolsUsed = &parserArgs.cmPolsIds[parserParams.cmPolsOffset];",
        "    uint16_t* constPolsUsed = &parserArgs.constPolsIds[parserParams.constPolsOffset];\n",
        "    Goldilocks::Element bufferT[nOpenings*nrowsPack];\n",
        "    for(uint64_t k = 0; k < parserParams.nConstPolsUsed; ++k) {",
        "        uint64_t id = constPolsUsed[k];",
        "        for(uint64_t o = 0; o < nOpenings; ++o) {",
        "            for(uint64_t j = 0; j < nrowsPack; ++j) {",
        "                uint64_t l = (row + j + nextStrides[o]) % domainSize;",
        "                bufferT[nrowsPack*o + j] = constPols[l * nColsStages[0] + id];",
        "            }",
        "            Goldilocks::load_avx(bufferT_[nOpenings * id + o], &bufferT[nrowsPack*o]);",
        "        }",
        "    }\n",
        "    for(uint64_t k = 0; k < parserParams.nCmPolsUsed; ++k) {",
        "        uint64_t polId = cmPolsUsed[k];",
        "        PolMap polInfo = starkInfo.cmPolsMap[polId];",
        "        uint64_t stage = polInfo.stage;",
        "        uint64_t stagePos = polInfo.stagePos;",
        "        for(uint64_t d = 0; d < polInfo.dim; ++d) {",
        "            for(uint64_t o = 0; o < nOpenings; ++o) {",
        "                for(uint64_t j = 0; j < nrowsPack; ++j) {",
        "                    uint64_t l = (row + j + nextStrides[o]) % domainSize;",
        "                    bufferT[nrowsPack*o + j] = params.pols[offsetsStages[stage] + l * nColsStages[stage] + stagePos + d];",
        "                }",
        "                Goldilocks::load_avx(bufferT_[nOpenings * nColsStagesAcc[stage] + nOpenings * (stagePos + d) + o], &bufferT[nrowsPack*o]);",
        "            }",
        "        }",
        "    }\n",
        "    if(parserParams.expId == starkInfo.cExpId) {",
        "        for(uint64_t d = 0; d < starkInfo.boundaries.size(); ++d) {",
        "            for(uint64_t j = 0; j < nrowsPack; ++j) {",
        "                bufferT[j] = params.zi[row + j + d*domainSize];",
        "            }",
        "            Goldilocks::load_avx(bufferT_[buffTOffsetsStages[starkInfo.nStages + 2] + d], &bufferT[0]);",
        "        }",
        "    } else if(parserParams.expId == starkInfo.friExpId) {",
        "        for(uint64_t d = 0; d < starkInfo.openingPoints.size(); ++d) {",
        "           for(uint64_t k = 0; k < FIELD_EXTENSION; ++k) {",
        "                for(uint64_t j = 0; j < nrowsPack; ++j) {",
        `                    bufferT[j] = params.pols[starkInfo.mapOffsets[std::make_pair("xDivXSubXi", true)] + (row + j + d*domainSize)*FIELD_EXTENSION + k];`,
        "                }",
        "                Goldilocks::load_avx(bufferT_[buffTOffsetsStages[starkInfo.nStages + 2] + d + k*nOpenings], &bufferT[0]);",
        "            }",
        "        }",
        "    }",
        "}\n",
    ])

    parserCPP.push(...[
        `inline void storePolynomial(Goldilocks::Element* dest, ParserParams& parserParams, uint64_t row, __m256i* tmp1, Goldilocks3::Element_avx* tmp3, bool inverse) {`,
        "    if(parserParams.destDim == 1) {",
        "        Goldilocks::store_avx(&dest[row], uint64_t(1), tmp1[parserParams.destId]);",
        "        if(inverse) {",
        "            for(uint64_t i = 0; i < nrowsPack; ++i) {",
        "                Goldilocks::inv(dest[row + i], dest[row + i]);",
        "            }",
        "        }",
        "    } else {",
        "        Goldilocks::store_avx(&dest[row*FIELD_EXTENSION], uint64_t(FIELD_EXTENSION), tmp3[parserParams.destId][0]);",
        "        Goldilocks::store_avx(&dest[row*FIELD_EXTENSION + 1], uint64_t(FIELD_EXTENSION), tmp3[parserParams.destId][1]);",
        "        Goldilocks::store_avx(&dest[row*FIELD_EXTENSION + 2], uint64_t(FIELD_EXTENSION), tmp3[parserParams.destId][2]);",
        "        if(inverse) {",
        "            for(uint64_t i = 0; i < nrowsPack; ++i) {",
        "                Goldilocks3::inv((Goldilocks3::Element *)&dest[(row + i)*FIELD_EXTENSION], (Goldilocks3::Element *)&dest[(row + i)*FIELD_EXTENSION]);",
        "            }",
        "        }",
        "    }",
        "}\n",
    ]);

    parserCPP.push(...[
        `inline void printTmp1(uint64_t row, __m256i tmp) {`,
        "    Goldilocks::Element dest[nrowsPack];",
        "    Goldilocks::store_avx(dest, tmp);",
        "    for(uint64_t i = 0; i < 1; ++i) {",
        `        cout << "Value at row " << row + i << " is " << Goldilocks::toString(dest[i]) << endl;`,
        "    }",
        "}\n"
    ]);
    
    parserCPP.push(...[
        `inline void printTmp3(uint64_t row, Goldilocks3::Element_avx tmp) {`,
        "    Goldilocks::Element dest[FIELD_EXTENSION*nrowsPack];",
        "    Goldilocks::store_avx(&dest[0], uint64_t(FIELD_EXTENSION), tmp[0]);",
        "    Goldilocks::store_avx(&dest[1], uint64_t(FIELD_EXTENSION), tmp[1]);",
        "    Goldilocks::store_avx(&dest[2], uint64_t(FIELD_EXTENSION), tmp[2]);",
        "    for(uint64_t i = 0; i < 1; ++i) {",
        `        cout << "Value at row " << row + i << " is [" << Goldilocks::toString(dest[FIELD_EXTENSION*i]) << ", " << Goldilocks::toString(dest[FIELD_EXTENSION*i + 1]) << ", " << Goldilocks::toString(dest[FIELD_EXTENSION*i + 2]) << "]" << endl;`,
        "    }",
        "}\n",
    ]);
    
    parserCPP.push(...[
        `inline void printCommit(uint64_t row, __m256i* bufferT, bool extended) {`,
        "    if(extended) {",
        "        Goldilocks::Element dest[FIELD_EXTENSION*nrowsPack];",
        "        Goldilocks::store_avx(&dest[0], uint64_t(FIELD_EXTENSION), bufferT[0]);",
        "        Goldilocks::store_avx(&dest[1], uint64_t(FIELD_EXTENSION), bufferT[starkInfo.openingPoints.size()]);",
        "        Goldilocks::store_avx(&dest[2], uint64_t(FIELD_EXTENSION), bufferT[2*starkInfo.openingPoints.size()]);",
        "        for(uint64_t i = 0; i < 1; ++i) {",
        `            cout << "Value at row " << row + i << " is [" << Goldilocks::toString(dest[FIELD_EXTENSION*i]) << ", " << Goldilocks::toString(dest[FIELD_EXTENSION*i + 1]) << ", " << Goldilocks::toString(dest[FIELD_EXTENSION*i + 2]) << "]" << endl;`,
        "        }",
        "    } else {",
        "        Goldilocks::Element dest[nrowsPack];",
        "        Goldilocks::store_avx(&dest[0], bufferT[0]);",
        "        for(uint64_t i = 0; i < 1; ++i) {",
        `            cout << "Value at row " << row + i << " is " << Goldilocks::toString(dest[i]) << endl;`,
        "        }",
        "    }",
        "}\n",
    ]);
    
    parserCPP.push(...[
        `void calculateExpressions(Goldilocks::Element *dest, ParserArgs &parserArgs, ParserParams &parserParams, bool domainExtended, bool inverse) override {\n`,
        "    uint8_t* ops = &parserArgs.ops[parserParams.opsOffset];",
        "    uint16_t* args = &parserArgs.args[parserParams.argsOffset];",
        "    uint64_t* numbers = &parserArgs.numbers[parserParams.numbersOffset];\n",
        "    uint64_t nOpenings = starkInfo.openingPoints.size();",
        "    uint64_t domainSize = domainExtended ? 1 << starkInfo.starkStruct.nBitsExt : 1 << starkInfo.starkStruct.nBits;\n",
    ]);

    
    parserCPP.push(...[
        `    offsetsStages.resize(starkInfo.nStages + 3);`,
        `    nColsStages.resize(starkInfo.nStages + 3);`,
        `    nColsStagesAcc.resize(starkInfo.nStages + 3);`,
        `    buffTOffsetsStages.resize(starkInfo.nStages + 3);\n`,
        `    nCols = starkInfo.nConstants;`,
        `    offsetsStages[0] = 0;`,
        `    nColsStages[0] = starkInfo.nConstants;`,
        `    nColsStagesAcc[0] = 0;`,
        `    buffTOffsetsStages[0] = 0;\n`,
        `    uint64_t ns = !params_initialized ? 1 : starkInfo.nStages + 1;`,
        `    for(uint64_t stage = 1; stage <= ns; ++stage) {`,
        `        std::string section = "cm" + to_string(stage);`,
        `        offsetsStages[stage] = !params_initialized ? 0 : starkInfo.mapOffsets[std::make_pair(section, domainExtended)];`,
        `        nColsStages[stage] = starkInfo.mapSectionsN[section];`,
        `        nColsStagesAcc[stage] = nColsStagesAcc[stage - 1] + nColsStages[stage - 1];`,
        `        buffTOffsetsStages[stage] = buffTOffsetsStages[stage - 1] + nOpenings*nColsStages[stage - 1];`,
        `        nCols += nColsStages[stage];`,
        `    }\n`,
        "    if(parserParams.expId == starkInfo.cExpId || parserParams.expId == starkInfo.friExpId) {",
        "        nColsStagesAcc[starkInfo.nStages + 2] = nColsStagesAcc[starkInfo.nStages + 1] + nColsStages[starkInfo.nStages + 1];",
        "        buffTOffsetsStages[starkInfo.nStages + 2] = buffTOffsetsStages[starkInfo.nStages + 1] + nOpenings*nColsStages[starkInfo.nStages + 1];",
        "        if(parserParams.expId == starkInfo.cExpId) {",
        "            nCols += starkInfo.boundaries.size();",
        "        } else {",
        "            nCols += nOpenings*FIELD_EXTENSION;",
        "        }",
        "    }",
    ]);
      
    parserCPP.push(...[
        "    Goldilocks3::Element_avx challenges[starkInfo.challengesMap.size()];",
        "    Goldilocks3::Element_avx challenges_ops[starkInfo.challengesMap.size()];",
        "    for(uint64_t i = 0; i < starkInfo.challengesMap.size(); ++i) {",
        "        challenges[i][0] = _mm256_set1_epi64x(params.challenges[i * FIELD_EXTENSION].fe);",
        "        challenges[i][1] = _mm256_set1_epi64x(params.challenges[i * FIELD_EXTENSION + 1].fe);",
        "        challenges[i][2] = _mm256_set1_epi64x(params.challenges[i * FIELD_EXTENSION + 2].fe);\n",
        "        Goldilocks::Element challenges_aux[3];",
        "        challenges_aux[0] = params.challenges[i * FIELD_EXTENSION] + params.challenges[i * FIELD_EXTENSION + 1];",
        "        challenges_aux[1] = params.challenges[i * FIELD_EXTENSION] + params.challenges[i * FIELD_EXTENSION + 2];",
        "        challenges_aux[2] = params.challenges[i * FIELD_EXTENSION + 1] + params.challenges[i * FIELD_EXTENSION + 2];",
        "        challenges_ops[i][0] = _mm256_set1_epi64x(challenges_aux[0].fe);",
        "        challenges_ops[i][1] =  _mm256_set1_epi64x(challenges_aux[1].fe);",
        "        challenges_ops[i][2] =  _mm256_set1_epi64x(challenges_aux[2].fe);",
        "    }\n",
    ]);

    parserCPP.push(...[
        "    __m256i numbers_[parserParams.nNumbers];",
        "    for(uint64_t i = 0; i < parserParams.nNumbers; ++i) {",
        "        numbers_[i] = _mm256_set1_epi64x(numbers[i]);",
        "    }\n",
    ])

    parserCPP.push(...[
        "    __m256i publics[starkInfo.nPublics];",
        "    for(uint64_t i = 0; i < starkInfo.nPublics; ++i) {",
        "        publics[i] = _mm256_set1_epi64x(params.publicInputs[i].fe);",
        "    }\n",
    ]);

    parserCPP.push(...[
        "    Goldilocks3::Element_avx subproofValues[starkInfo.nSubProofValues];",
        "    for(uint64_t i = 0; i < starkInfo.nSubProofValues; ++i) {",
        "        subproofValues[i][0] = _mm256_set1_epi64x(params.subproofValues[i * FIELD_EXTENSION].fe);",
        "        subproofValues[i][1] = _mm256_set1_epi64x(params.subproofValues[i * FIELD_EXTENSION + 1].fe);",
        "        subproofValues[i][2] = _mm256_set1_epi64x(params.subproofValues[i * FIELD_EXTENSION + 2].fe);",
        "    }\n",
    ]);

    parserCPP.push(...[
        "    Goldilocks3::Element_avx evals[starkInfo.evMap.size()];",
        "    for(uint64_t i = 0; i < starkInfo.evMap.size(); ++i) {",
        "        evals[i][0] = _mm256_set1_epi64x(params.evals[i * FIELD_EXTENSION].fe);",
        "        evals[i][1] = _mm256_set1_epi64x(params.evals[i * FIELD_EXTENSION + 1].fe);",
        "        evals[i][2] = _mm256_set1_epi64x(params.evals[i * FIELD_EXTENSION + 2].fe);",
        "    }\n",
    ]);

    parserCPP.push(...[
        `#pragma omp parallel for`,
        `    for (uint64_t i = 0; i < domainSize; i+= nrowsPack) {`,
        "        uint64_t i_args = 0;\n",
        "        __m256i bufferT_[nOpenings*nCols];",
        "        __m256i tmp1[parserParams.nTemp1];",
        "        Goldilocks3::Element_avx tmp3[parserParams.nTemp3];\n",
    ]); 

    parserCPP.push("        loadPolynomials(parserArgs, parserParams, bufferT_, i, domainExtended);\n");
    
    parserCPP.push(...[
        "        for (uint64_t kk = 0; kk < parserParams.nOps; ++kk) {",
        `            switch (ops[kk]) {`,
    ]);
           
    for(let i = 0; i < operations.length; i++) {
        const op = operations[i];
        
        const operationCase = [`        case ${i}: {`];
        
        let operationDescription;
        if(op.op === "mul") {
            operationDescription = `                // MULTIPLICATION WITH DEST: ${op.dest_type} - SRC0: ${op.src0_type} - SRC1: ${op.src1_type}`;
        } else {
            operationDescription = `                // OPERATION WITH DEST: ${op.dest_type} - SRC0: ${op.src0_type} - SRC1: ${op.src1_type}`;
        }
        operationCase.push(operationDescription);
                
        operationCase.push(writeOperation(op));
        operationCase.push(`                i_args += ${c_args};`);

        operationCase.push(...[
            "                break;",
            "            }",
        ])
        parserCPP.push(operationCase.join("\n"));
        
    }

    parserCPP.push(...[
        "                default: {",
        `                    std::cout << " Wrong operation!" << std::endl;`,
        "                    exit(1);",
        "                }",
        "            }",
        "        }\n",
    ]);

    parserCPP.push(`        storePolynomial(dest, parserParams, i, tmp1, tmp3, inverse);\n`);
    parserCPP.push(...[
        `        if (i_args != parserParams.nArgs) std::cout << " " << i_args << " - " << parserParams.nArgs << std::endl;`,
        "        assert(i_args == parserParams.nArgs);",
        "    }\n"
    ]);

    parserCPP.push("}");
       
    
    const parserCPPCode = parserCPP.map(l => `    ${l}`).join("\n");

    return parserCPPCode;

    function writeOperation(operation) {

        let name = ["tmp1", "commit1"].includes(operation.dest_type) ? "Goldilocks::" : "Goldilocks3::";
        
        if(operation.op === "mul") {
            name += "mul";
        } else {
            name += "op";
        }

        if(["tmp3", "commit3"].includes(operation.dest_type)) {
            let dimType = "";
            let dims1 = ["public", "commit1", "tmp1", "const", "number", "Zi"];
            let dims3 = ["commit3", "tmp3", "subproofValue", "challenge", "eval", "xDivXSubXi"];
            if(dims1.includes(operation.src0_type)) dimType += "1";
            if (dims3.includes(operation.src0_type)) dimType += "3";
            if(dims1.includes(operation.src1_type)) dimType += "1";
            if (dims3.includes(operation.src1_type)) dimType += "3";

            if(dimType !== "33") name += "_" + dimType;
        } 
        
        name += "_avx(";

        c_args = 0;

        if(!operation.op) {
            name += `args[i_args + ${c_args}], `;
        }
        c_args++;

        let typeDest = writeType(operation.dest_type, c_args);
        c_args += numberOfArgs(operation.dest_type);

        let typeSrc0 = writeType(operation.src0_type, c_args);
        c_args += numberOfArgs(operation.src0_type);

        let typeSrc1 = writeType(operation.src1_type, c_args);
        c_args += numberOfArgs(operation.src1_type);

        const operationCall = [];

        if(operation.dest_type == "commit3" || (operation.src0_type === "commit3") || operation.src1_type === "commit3") {
            if(operation.dest_type === "commit3") {
                name += `&${typeDest}, nOpenings, \n                        `;
            } else {
                name += `&(${typeDest}[0]), 1, \n                        `;
            }

            if(operation.src0_type === "commit3") {
                name += `&${typeSrc0}, nOpenings, \n                        `;
            } else if(["tmp3", "challenge", "eval", "subproofValue"].includes(operation.src0_type)) {
                name += `&(${typeSrc0}[0]), 1, \n                        `;
            } else {
                name += typeSrc0 + ", ";
            }
            
            if(operation.src1_type === "commit3") {
                name += `&${typeSrc1}, nOpenings, \n                        `;
            } else if(["tmp3", "eval", "subproofValue"].includes(operation.src1_type) || (!operation.op && operation.src1_type === "challenge")) {
                name += `&(${typeSrc1}[0]), 1, \n                        `;
            } else if(operation.op === "mul" && operation.src1_type === "challenge") {
                name += `${typeSrc1}, ${typeSrc1.replace("challenges", "challenges_ops")}, \n                        `;
            } else {
                name += typeSrc1 + ", ";
            }

        } else {
            name += typeDest + ", ";
            name += typeSrc0 + ", ";
            if(operation.op === "mul" && operation.src1_type === "challenge") {
                name += `${typeSrc1}, ${typeSrc1.replace("challenges", "challenges_ops")}, \n                        `;
            } else {
                name += typeSrc1 + ", ";
            }
        }

        

        name = name.substring(0, name.lastIndexOf(", ")) + ");";

        operationCall.push(`                ${name}`);
       
        return operationCall.join("\n").replace(/i_args \+ 0/g, "i_args");
    }
}


module.exports.getOperation = function getOperation(r) {
    const _op = {};
    _op.op = r.op;
    if(r.dest.type === "cm") {
        _op.dest_type = `commit${r.dest.dim}`;
    } else if(r.dest.type === "tmp") {
        _op.dest_type = `tmp${r.dest.dim}`;
    } else {
        _op.dest_type = r.dest.type;
    }
    
    let src = [...r.src];
    src.sort((a, b) => {
        let opA =  a.type === "cm" ? operationsMap[`commit${a.dim}`] : a.type === "tmp" ? operationsMap[`tmp${a.dim}`] : operationsMap[a.type];
        let opB = b.type === "cm" ? operationsMap[`commit${b.dim}`] : b.type === "tmp" ? operationsMap[`tmp${b.dim}`] : operationsMap[b.type];
        let swap = a.dim !== b.dim ? b.dim - a.dim : opA - opB;
        if(r.op === "sub" && swap < 0) _op.op = "sub_swap";
        return swap;
    });
    

    for(let i = 0; i < src.length; i++) {
        if(src[i].type === "cm") {
            _op[`src${i}_type`] = `commit${src[i].dim}`;
        } else if(src[i].type === "const" || src[i].type === "Zi") {
            _op[`src${i}_type`] = "commit1";
        } else if(src[i].type === "xDivXSubXi") {
            _op[`src${i}_type`] = "commit3";
        } else if(src[i].type === "tmp") {
            _op[`src${i}_type`] =  `tmp${src[i].dim}`;
        } else {
            _op[`src${i}_type`] = src[i].type;
        }
    }

    _op.src = src;
    
    return _op;
}