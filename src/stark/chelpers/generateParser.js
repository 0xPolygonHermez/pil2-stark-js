const operationsMap = {
    "commit1": 1,
    "const": 2,
    "tmp1": 3,
    "public": 4,
    "number": 5,
    "commit3": 6,
    "xDivXSubXi": 7,
    "tmp3": 8,
    "subproofValue": 9,
    "challenge": 10, 
    "eval": 11,
}

module.exports.generateParser = function generateParser(operations, operationsUsed) {

    let c_args = 0;

    let functionType = !operationsUsed ? "virtual void" : "void";
    
    const parserCPP = [];

    parserCPP.push(...[
        "uint64_t nrowsPack = 4;",
        "uint64_t nCols;",
        "vector<uint64_t> nColsStages;",
        "vector<uint64_t> nColsStagesAcc;",
        "vector<uint64_t> offsetsStages;",
        "vector<uint64_t> buffTOffsetsStages;\n",
    ]);
    parserCPP.push(...[
        `inline ${functionType} isConstraintValid(std::vector<bool> validConstraint, ParserParams& parserParams, uint64_t row, __m256i* tmp1, Goldilocks3::Element_avx* tmp3) {`,
        "    if(parserParams.destDim == 1) {",
        "        Goldilocks::Element res[4];",
        "        Goldilocks::store_avx(res, tmp1[parserParams.destId]);",
        "        for(uint64_t j = 0; j < 4; ++j) {",
        "            if(row + j < parserParams.firstRow) continue;",
        "            if(row + j >= parserParams.lastRow) break;",
        "            if(!Goldilocks::isZero(res[j])) {",
        "                validConstraint[row + j] = false;",
        "            }",
        "        }",
        "    } else if(parserParams.destDim == 3) {",
        "        Goldilocks::Element res[12];",
        "        Goldilocks::store_avx(&res[0], tmp3[parserParams.destId][0]);",
        "        Goldilocks::store_avx(&res[4], tmp3[parserParams.destId][1]);",
        "        Goldilocks::store_avx(&res[8], tmp3[parserParams.destId][2]);",
        "        for(uint64_t j = 0; j < 4; ++j) {",
        "            if(row + j < parserParams.firstRow) continue;",
        "            if(row + j >= parserParams.lastRow) break;",
        "            for(uint64_t k = 0; k < 3; ++k) {",
        "                if(!Goldilocks::isZero(res[3*j + k])) {",
        "                    validConstraint[row + j] = false;",
        "                }",
        "            }",
        "        }",
        "    }",
        "}\n",
    ]);

    parserCPP.push(...[
        `inline ${functionType} verifyConstraint(std::vector<bool> validConstraint, uint64_t domainSize) {`,
        "    bool isValidConstraint = true;",
        "    uint64_t nInvalidRows = 0;",
        "    uint64_t maxInvalidRowsDisplay = 100;",
        "    for(uint64_t i = 0; i < domainSize; ++i) {",
        "        if(!validConstraint[i]) {",
        "            isValidConstraint = false;",
        "            if(nInvalidRows < maxInvalidRowsDisplay) {",
        `                cout << "Constraint check failed at " << i << endl;`,
        "                nInvalidRows++;",
        "            } else {",
        `                cout << "There are more than " << maxInvalidRowsDisplay << " invalid rows" << endl;`,
        "                break;",
        "            }",
        "        }",
        "    }",
        "    if(isValidConstraint) {",
        "        TimerLog(CONSTRAINT_CHECKS_PASSED);",
        "    } else {",
        "        TimerLog(CONSTRAINT_CHECKS_FAILED);",
        "    }",
        "}\n",
    ])

    parserCPP.push(...[
        `inline ${functionType} loadPolynomials(StarkInfo &starkInfo, StepsParams &params, ParserArgs &parserArgs, ParserParams &parserParams, __m256i *bufferT_, uint64_t row, bool domainExtended) {`,
        "    uint64_t nOpenings = starkInfo.openingPoints.size();",
        "    uint64_t domainSize = domainExtended ? 1 << starkInfo.starkStruct.nBitsExt : 1 << starkInfo.starkStruct.nBits;\n",
        "    uint64_t extendBits = (starkInfo.starkStruct.nBitsExt - starkInfo.starkStruct.nBits);",
        "    int64_t extend = domainExtended ? (1 << extendBits) : 1;",
        "    uint64_t nextStrides[nOpenings];",
        "    for(uint64_t i = 0; i < nOpenings; ++i) {",
        "        uint64_t opening = starkInfo.openingPoints[i] < 0 ? starkInfo.openingPoints[i] + domainSize : starkInfo.openingPoints[i];",
        "        nextStrides[i] = opening * extend;",
        "    }\n",
        "    ConstantPolsStarks *constPols = domainExtended ? params.pConstPols2ns : params.pConstPols;\n",
        "    uint16_t* cmPolsUsed = &parserArgs.cmPolsIds[parserParams.cmPolsOffset];",
        "    uint16_t* constPolsUsed = &parserArgs.constPolsIds[parserParams.constPolsOffset];\n",
        "    Goldilocks::Element bufferT[nOpenings*nrowsPack];\n",
        "    for(uint64_t k = 0; k < parserParams.nConstPolsUsed; ++k) {",
        "        uint64_t id = constPolsUsed[k];",
        "        for(uint64_t o = 0; o < nOpenings; ++o) {",
        "            for(uint64_t j = 0; j < nrowsPack; ++j) {",
        "                uint64_t l = (row + j + nextStrides[o]) % domainSize;",
        "                bufferT[nrowsPack*o + j] = ((Goldilocks::Element *)constPols->address())[l * nColsStages[0] + id];",
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
        "               for(uint64_t j = 0; j < nrowsPack; ++j) {",
        "                   bufferT[j] = params.xDivXSubXi[(row + j + d*domainSize)*FIELD_EXTENSION + k];",
        "                }",
        "                Goldilocks::load_avx(bufferT_[buffTOffsetsStages[starkInfo.nStages + 2] + d*FIELD_EXTENSION + k*starkInfo.openingPoints.size()], &bufferT[0]);",
        "            }",
        "        }",
        "    }",
        "}\n",
    ])

    parserCPP.push(...[
        `inline ${functionType} storePolynomial(Goldilocks::Element* dest, ParserParams& parserParams, uint64_t row, __m256i* tmp1, Goldilocks3::Element_avx* tmp3) {`,
        "    if(parserParams.destDim == 1) {",
        "        Goldilocks::store_avx(&dest[row], uint64_t(1), tmp1[parserParams.destId]);",
        "    } else {",
        "        Goldilocks::store_avx(&dest[row*FIELD_EXTENSION], uint64_t(FIELD_EXTENSION), tmp3[parserParams.destId][0]);",
        "        Goldilocks::store_avx(&dest[row*FIELD_EXTENSION + 1], uint64_t(FIELD_EXTENSION), tmp3[parserParams.destId][1]);",
        "        Goldilocks::store_avx(&dest[row*FIELD_EXTENSION + 2], uint64_t(FIELD_EXTENSION), tmp3[parserParams.destId][2]);",
        "    }",
        "}\n",
    ]);

    parserCPP.push(...[
        `inline ${functionType} storeImPolynomials(StarkInfo &starkInfo, StepsParams &params, __m256i *bufferT_, uint64_t row) {`,
        "    auto openingPointIndex = std::find(starkInfo.openingPoints.begin(), starkInfo.openingPoints.end(), 0) - starkInfo.openingPoints.begin();\n",
        "    auto firstImPol = std::find_if(starkInfo.cmPolsMap.begin(), starkInfo.cmPolsMap.end(), [](const PolMap& s) { return s.imPol; });\n",
        "    if(firstImPol != starkInfo.cmPolsMap.end()) {",
        "        uint64_t firstImPolPos = firstImPol->stagePos;",
        "        uint64_t stage = starkInfo.nStages;",
        "        for(uint64_t k = firstImPolPos; k < nColsStages[stage]; ++k) {",
        "            Goldilocks::store_avx(&params.pols[offsetsStages[stage] + k + row * nColsStages[stage]], nColsStages[stage], bufferT_[buffTOffsetsStages[stage] + starkInfo.openingPoints.size() * k + openingPointIndex]);",
        "        }",
        "    }",
        "}\n",
    ])

    parserCPP.push(...[
        `${functionType} calculateExpressions(Goldilocks::Element *dest, StarkInfo &starkInfo, StepsParams &params, ParserArgs &parserArgs, ParserParams &parserParams, bool domainExtended) {\n`,
        "    uint8_t* ops = &parserArgs.ops[parserParams.opsOffset];",
        "    uint16_t* args = &parserArgs.args[parserParams.argsOffset];",
        "    uint64_t* numbers = &parserArgs.numbers[parserParams.numbersOffset];\n",
        "    uint64_t nOpenings = starkInfo.openingPoints.size();",
        "    uint64_t domainSize = domainExtended ? 1 << starkInfo.starkStruct.nBitsExt : 1 << starkInfo.starkStruct.nBits;\n",
        "    std::vector<bool> validConstraint(domainSize, true);\n"
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
        `    for(uint64_t stage = 1; stage <= starkInfo.nStages + 1; ++stage) {`,
        `        std::string section = "cm" + to_string(stage);`,
        `        offsetsStages[stage] = starkInfo.mapOffsets[std::make_pair(section, domainExtended)];`,
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

    parserCPP.push("\n");
    parserCPP.push("        loadPolynomials(starkInfo, params, parserArgs, parserParams, bufferT_, i, domainExtended);\n");
    
    parserCPP.push(...[
        "\n",
        "        for (uint64_t kk = 0; kk < parserParams.nOps; ++kk) {",
        `            switch (ops[kk]) {`,
    ]);
           
    for(let i = 0; i < operations.length; i++) {
        if(operationsUsed && !operationsUsed.includes(i)) continue;
        const op = operations[i];
        
        
        const operationCase = [`        case ${i}: {`];
        
        if(!op.isGroupOps) {
            let operationDescription;
            if(op.op === "mul") {
                operationDescription = `                // MULTIPLICATION WITH DEST: ${op.dest_type} - SRC0: ${op.src0_type} - SRC1: ${op.src1_type}`;
            } else {
                operationDescription = `                // OPERATION WITH DEST: ${op.dest_type} - SRC0: ${op.src0_type} - SRC1: ${op.src1_type}`;
            }
            operationCase.push(operationDescription);
        }
                
        
        if(op.isGroupOps) {
            for(let j = 0; j < op.ops.length; j++) {
                let opr = operations[op.ops[j]];
                operationCase.push(writeOperation(opr));
                let numberArgs = numberOfArgs(opr.dest_type) + numberOfArgs(opr.src0_type);
                if(opr.src1_type && opr.dest_type !== "q") numberArgs += numberOfArgs(opr.src1_type) + 1;
                if(opr.dest_type == "q") numberArgs++;
                operationCase.push(`                i_args += ${numberArgs};`);
            }
        } else {
            operationCase.push(writeOperation(op));
            let numberArgs = numberOfArgs(op.dest_type) + numberOfArgs(op.src0_type);
            if(op.src1_type && op.dest_type !== "q") numberArgs += numberOfArgs(op.src1_type) + 1;
            if(op.dest_type == "q") numberArgs++;
            operationCase.push(`                i_args += ${numberArgs};`);
        }

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
        "        }",
    ]);

    parserCPP.push(...[
        "        if (dest == nullptr && parserParams.destDim != 0) {",
        "            isConstraintValid(validConstraint, parserParams, i, tmp1, tmp3);",
        "        }\n",
        "        if(dest != nullptr) {",
        "            storePolynomial(dest, parserParams, i, tmp1, tmp3);",
        "        }\n",
        "        if(parserParams.nCmPolsCalculated > 0) {",
        "            storeImPolynomials(starkInfo, params, bufferT_, i);",
        "        }\n",
    ]);

    parserCPP.push(...[
        `        if (i_args != parserParams.nArgs) std::cout << " " << i_args << " - " << parserParams.nArgs << std::endl;`,
        "        assert(i_args == parserParams.nArgs);",
        "    }\n"
    ]);

    parserCPP.push(...[
        "    if(dest == nullptr && parserParams.destDim != 0) {",
        "        verifyConstraint(validConstraint, domainSize);",
        "    }"
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
            if(operation.src1_type)  {
                let dimType = "";
                let dims1 = ["public", "commit1", "tmp1", "const", "number", "Zi"];
                let dims3 = ["commit3", "tmp3", "subproofValue", "challenge", "eval", "xDivXSubXi"];
                if(dims1.includes(operation.src0_type)) dimType += "1";
                if (dims3.includes(operation.src0_type)) dimType += "3";
                if(dims1.includes(operation.src1_type)) dimType += "1";
                if (dims3.includes(operation.src1_type)) dimType += "3";
    
                if(dimType !== "33") name += "_" + dimType;
            }
        } 
        
        name += "_avx(";

        c_args = 0;

        if(operation.src1_type) {
            if(!operation.op) {
                name += `args[i_args + ${c_args}], `;
            }
            c_args++;
        }      

        let typeDest = writeType(operation.dest_type);

        let operationStoreAvx;

        if(operation.dest_type === "f") {
            operationStoreAvx = `                Goldilocks3::store_avx(&params.f_2ns[i*FIELD_EXTENSION], uint64_t(FIELD_EXTENSION), tmp3_);`;
        }


        c_args += numberOfArgs(operation.dest_type);

        let typeSrc0 = writeType(operation.src0_type);
        c_args += numberOfArgs(operation.src0_type);

        let typeSrc1;

        const operationCall = [];

        if(operation.src1_type) {
            typeSrc1 = writeType(operation.src1_type);
            c_args += numberOfArgs(operation.src1_type);
        }

        if(operation.dest_type == "commit3" || (operation.src0_type === "commit3") || (operation.src1_type && operation.src1_type === "commit3")) {
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
            if(operation.src1_type) {
                if(operation.src1_type === "commit3") {
                    name += `&${typeSrc1}, nOpenings, \n                        `;
                } else if(["tmp3", "eval", "subproofValue"].includes(operation.src1_type) || (!operation.op && operation.src1_type === "challenge")) {
                    name += `&(${typeSrc1}[0]), 1, \n                        `;
                } else if(operation.op === "mul" && operation.src1_type === "challenge") {
                    name += `${typeSrc1}, ${typeSrc1.replace("challenges", "challenges_ops")}, \n                        `;
                } else {
                    name += typeSrc1 + ", ";
                }
            }
        } else {
            if(operation.dest_type === "f") {
                name += "tmp3_, ";
	        } else {
                name += typeDest + ", ";
            }
            name += typeSrc0 + ", ";
            if(operation.src1_type) {
                if(operation.op === "mul" && operation.src1_type === "challenge") {
                    name += `${typeSrc1}, ${typeSrc1.replace("challenges", "challenges_ops")}, \n                        `;
                } else {
                    name += typeSrc1 + ", ";
                }
            }
        }

        

        name = name.substring(0, name.lastIndexOf(", ")) + ");";

        operationCall.push(`                ${name}`);
        if(operationStoreAvx) {
            operationCall.push(operationStoreAvx);
        }

        return operationCall.join("\n").replace(/i_args \+ 0/g, "i_args");
    }

    function writeType(type) {
        switch (type) {
            case "public":
                return `publics[args[i_args + ${c_args}]]`;
            case "tmp1":
                return `tmp1[args[i_args + ${c_args}]]`; 
            case "tmp3":
                return `tmp3[args[i_args + ${c_args}]]`;
            case "commit1":
            case "commit3":
            case "const":
                return `bufferT_[buffTOffsetsStages[args[i_args + ${c_args}]] + nOpenings * args[i_args + ${c_args + 1}] + args[i_args + ${c_args + 2}]]`;
            case "challenge":
                return `challenges[args[i_args + ${c_args}]]`;
            case "eval":
                return `evals[args[i_args + ${c_args}]]`;
            case "subproofValue":
                return `subproofValues[args[i_args + ${c_args}]]`;
            case "number":
                return `numbers_[args[i_args + ${c_args}]]`;
            default:
                throw new Error("Invalid type: " + type);
        }
    }

    function numberOfArgs(type) {
        switch (type) {
            case "public":            
            case "tmp1":
            case "tmp3":
            case "challenge":
            case "eval":
            case "subproofValue":
            case "number":
                return 1;
            case "const":
            case "commit1":
            case "commit3":
                return 3;  
            default:
                throw new Error("Invalid type: " + type);
        }
    }
}

module.exports.getAllOperations = function getAllOperations() {
    const possibleOps = [];

    const possibleDestinationsDim1 = [ "commit1", "tmp1" ];
    const possibleDestinationsDim3 = [ "commit3", "tmp3" ];

    const possibleSrcDim1 = [ "commit1", "tmp1", "public", "number" ];
    const possibleSrcDim3 = [ "commit3", "tmp3", "challenge", "subproofValue" ];

    // Dim1 destinations
    for(let j = 0; j < possibleDestinationsDim1.length; j++) {
        let dest_type = possibleDestinationsDim1[j];
        for(let k = 0; k < possibleSrcDim1.length; ++k) {
            let src0_type = possibleSrcDim1[k];
            for (let l = k; l < possibleSrcDim1.length; ++l) {
                let src1_type = possibleSrcDim1[l];
                possibleOps.push({dest_type, src0_type, src1_type})
            } 
        }
    }

    // Dim3 destinations
    for(let j = 0; j < possibleDestinationsDim3.length; j++) {
        let dest_type = possibleDestinationsDim3[j];


        // Dest dim 3, sources dimension 3 and 1
        for(let k = 0; k < possibleSrcDim3.length; ++k) {
            let src0_type = possibleSrcDim3[k];
            
            for (let l = 0; l < possibleSrcDim1.length; ++l) {
                let src1_type = possibleSrcDim1[l];
                possibleOps.push({dest_type, src0_type, src1_type});
            }
        }

        for(let k = 0; k < possibleSrcDim3.length; ++k) {
            let src0_type = possibleSrcDim3[k];
            for (let l = k; l < possibleSrcDim3.length; ++l) {
                let src1_type = possibleSrcDim3[l];
                if(src0_type === "challenge") {
                    possibleOps.push({op: "mul", dest_type, src0_type: src1_type, src1_type: src0_type});
                } else if(src1_type === "challenge") {
                    possibleOps.push({op: "mul", dest_type, src0_type, src1_type});
                }
                possibleOps.push({dest_type, src0_type, src1_type})
            }
        }
    }

    // Step FRI
    possibleOps.push({ op: "mul", dest_type: "tmp3", src0_type: "eval", src1_type: "challenge"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "challenge", src1_type: "eval"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "tmp3", src1_type: "eval"});

    possibleOps.push({ dest_type: "tmp3", src0_type: "eval", src1_type: "commit1"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "commit3", src1_type: "eval"});
    
    return possibleOps;
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