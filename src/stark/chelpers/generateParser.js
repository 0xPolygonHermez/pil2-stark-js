const operationsMap = {
    "commit1": 1,
    "const": 2,
    "tmp1": 3,
    "public": 4,
    "x": 5,
    "number": 6,
    "commit3": 7,
    "tmp3": 8,
    "subproofValue": 9,
    "challenge": 10, 
    "eval": 11,
    "xDivXSubXi": 12,
    "q": 13, 
    "f": 14,
}

module.exports.generateParser = function generateParser(operations, operationsUsed) {

    let c_args = 0;

    let functionType = !operationsUsed ? "virtual void" : "void";
    
    const parserCPP = [
        `${functionType} storePolinomial(Goldilocks::Element *pols, __m256i *bufferT, uint64_t* nColsSteps, uint64_t *offsetsSteps, uint64_t *buffTOffsetsSteps, uint64_t *nextStrides, uint64_t nOpenings, uint64_t domainSize, bool domainExtended, uint64_t nStages, bool needModule, uint64_t row, uint64_t stage, uint64_t stagePos, uint64_t openingPointIndex, uint64_t dim) {`,
        "    bool isTmpPol = !domainExtended && nStages + 1 == stage;",
        "    if(needModule) {",
        "        uint64_t offsetsDest[4];",
        "        uint64_t nextStrideOffset = row + nextStrides[openingPointIndex];",
        "        if(isTmpPol) {",
        "            uint64_t stepOffset = offsetsSteps[stage] + stagePos * domainSize;",
        "            offsetsDest[0] = stepOffset + (nextStrideOffset % domainSize) * dim;",
        "            offsetsDest[1] = stepOffset + ((nextStrideOffset + 1) % domainSize) * dim;",
        "            offsetsDest[2] = stepOffset + ((nextStrideOffset + 2) % domainSize) * dim;",
        "            offsetsDest[3] = stepOffset + ((nextStrideOffset + 3) % domainSize) * dim;",
        "        } else {",
        "            uint64_t stepOffset = offsetsSteps[stage] + stagePos;",
        "            offsetsDest[0] = stepOffset + (nextStrideOffset % domainSize) * nColsSteps[stage];",
        "            offsetsDest[1] = stepOffset + ((nextStrideOffset + 1) % domainSize) * nColsSteps[stage];",
        "            offsetsDest[2] = stepOffset + ((nextStrideOffset + 2) % domainSize) * nColsSteps[stage];",
        "            offsetsDest[3] = stepOffset + ((nextStrideOffset + 3) % domainSize) * nColsSteps[stage];",
        "        }",
        "        if(dim == 1) {",
        "            Goldilocks::store_avx(&pols[0], offsetsDest, bufferT[buffTOffsetsSteps[stage] + nOpenings * stagePos + openingPointIndex]);",
        "        } else {",
        "            Goldilocks3::store_avx(&pols[0], offsetsDest, &bufferT[buffTOffsetsSteps[stage] + nOpenings * stagePos + openingPointIndex], nOpenings);",
        "        }",
        "    } else {",
        "        if(dim == 1) {",
        "            if(isTmpPol) {",
        "                Goldilocks::store_avx(&pols[offsetsSteps[stage] + stagePos * domainSize + (row + nextStrides[openingPointIndex])], uint64_t(1), bufferT[buffTOffsetsSteps[stage] + nOpenings * stagePos + openingPointIndex]);",
        "            } else {",
        "                Goldilocks::store_avx(&pols[offsetsSteps[stage] + stagePos + (row + nextStrides[openingPointIndex]) * nColsSteps[stage]], nColsSteps[stage], bufferT[buffTOffsetsSteps[stage] + nOpenings * stagePos + openingPointIndex]);",
        "            }",
        "        } else {",
        "            if(isTmpPol) {",
        "                Goldilocks3::store_avx(&pols[offsetsSteps[stage] + stagePos * domainSize + (row + nextStrides[openingPointIndex]) * FIELD_EXTENSION], uint64_t(FIELD_EXTENSION), &bufferT[buffTOffsetsSteps[stage] + nOpenings * stagePos + openingPointIndex], nOpenings);",
        "            } else {",
        "                Goldilocks3::store_avx(&pols[offsetsSteps[stage] + stagePos + (row + nextStrides[openingPointIndex]) * nColsSteps[stage]], nColsSteps[stage], &bufferT[buffTOffsetsSteps[stage] + nOpenings * stagePos + openingPointIndex], nOpenings);",
        "            }",
        "        }",
        "    }",
        "}\n",
    ];

    parserCPP.push(...[
        `${functionType} calculateExpressions(StarkInfo &starkInfo, StepsParams &params, ParserArgs &parserArgs, ParserParams &parserParams, uint32_t nrowsBatch, bool domainExtended) {`,
        "    uint64_t domainSize = domainExtended ? 1 << starkInfo.starkStruct.nBitsExt : 1 << starkInfo.starkStruct.nBits;",
        "    uint64_t extendBits = (starkInfo.starkStruct.nBitsExt - starkInfo.starkStruct.nBits);",
        "    int64_t extend = domainExtended ? (1 << extendBits) : 1;",
        "    Goldilocks::Element *x = domainExtended ? params.x_2ns : params.x_n;", 
        "    ConstantPolsStarks *constPols = domainExtended ? params.pConstPols2ns : params.pConstPols;",
        "    uint8_t *ops = &parserArgs.ops[parserParams.opsOffset];\n",
        "    uint16_t *args = &parserArgs.args[parserParams.argsOffset]; \n",
        "    uint64_t* numbers = &parserArgs.numbers[parserParams.numbersOffset];\n",
        "    uint16_t* cmPolsUsed = &parserArgs.cmPolsIds[parserParams.cmPolsOffset];\n",
        "    uint16_t* constPolsUsed = &parserArgs.constPolsIds[parserParams.constPolsOffset];\n",
        "    uint64_t nStages = starkInfo.nStages;",
        "    uint64_t nOpenings = starkInfo.openingPoints.size();",
        "    uint64_t nextStrides[nOpenings];",
        "    for(uint64_t i = 0; i < nOpenings; ++i) {",
        "        uint64_t opening = starkInfo.openingPoints[i] < 0 ? starkInfo.openingPoints[i] + domainSize : starkInfo.openingPoints[i];",
        "        nextStrides[i] = opening * extend;",
        "    }",
        "    std::vector<bool> validConstraint(domainSize, true);"
    ]);

    
    parserCPP.push(...[
        `    uint64_t nCols = starkInfo.nConstants;`,
        `    uint64_t buffTOffsetsSteps_[nStages + 2];`,
        `    uint64_t nColsSteps[nStages + 2];`,
        `    uint64_t nColsStepsAccumulated[nStages + 2];`,
        `    uint64_t offsetsSteps[nStages + 2];\n`,
        `    offsetsSteps[0] = 0;`,
        `    nColsSteps[0] = starkInfo.nConstants;`,
        `    nColsStepsAccumulated[0] = 0;`,
        `    buffTOffsetsSteps_[0] = 0;`,
        `    for(uint64_t stage = 1; stage <= nStages; ++stage) {`,
        `        std::string section = "cm" + to_string(stage);`,
        `        offsetsSteps[stage] = starkInfo.mapOffsets[std::make_pair(section, domainExtended)];`,
        `        nColsSteps[stage] = starkInfo.mapSectionsN[section];`,
        `        nColsStepsAccumulated[stage] = nColsStepsAccumulated[stage - 1] + nColsSteps[stage - 1];`,
        `        buffTOffsetsSteps_[stage] = buffTOffsetsSteps_[stage - 1] + nOpenings*nColsSteps[stage - 1];`,
        `        nCols += nColsSteps[stage];`,
        `    }`,
    ]);

    parserCPP.push(...[
        "    if(parserParams.stage <= nStages) {",
        `        offsetsSteps[nStages + 1] = starkInfo.mapOffsets[std::make_pair("tmpExp", false)];`,
        `        nColsSteps[nStages + 1] = starkInfo.mapSectionsN["tmpExp"];`,
        "    } else {",
        `        std::string section = "cm" + to_string(nStages + 1);`,
        `        offsetsSteps[nStages + 1] = starkInfo.mapOffsets[std::make_pair(section, true)];`,
        `        nColsSteps[nStages + 1] = starkInfo.mapSectionsN[section];`,
        "    }",
        `    nColsStepsAccumulated[nStages + 1] = nColsStepsAccumulated[nStages] + nColsSteps[nStages];`,
        `    buffTOffsetsSteps_[nStages + 1] = buffTOffsetsSteps_[nStages] + nOpenings*nColsSteps[nStages];`,
        `    nCols += nColsSteps[nStages + 1];\n`,
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
        `    for (uint64_t i = 0; i < domainSize; i+= nrowsBatch) {`,
        "        bool const needModule = ((static_cast<int64_t>(i + nrowsBatch) + extend*starkInfo.openingPoints[nOpenings - 1]) >= static_cast<int64_t>(domainSize)) || ((static_cast<int64_t>(i) + extend*starkInfo.openingPoints[0]) < 0);",
        "        uint64_t i_args = 0;\n",
        "        __m256i tmp1[parserParams.nTemp1];",
        "        Goldilocks3::Element_avx tmp3[parserParams.nTemp3];",
        "        Goldilocks3::Element_avx tmp3_;",
        "        // Goldilocks3::Element_avx tmp3_0;",
        "        Goldilocks3::Element_avx tmp3_1;",
        "        __m256i tmp1_1;",
        "        __m256i bufferT_[nOpenings*nCols];\n",
    ]); 

    if(!operationsUsed) parserCPP.push(        "        __m256i tmp1_0;");

    parserCPP.push(...[
        "        Goldilocks::Element bufferT[nOpenings*nrowsBatch];\n",
        "        for(uint64_t k = 0; k < parserParams.nConstPolsUsed; ++k) {",
        "            uint64_t id = constPolsUsed[k];",
        "            for(uint64_t o = 0; o < nOpenings; ++o) {",
        "                for(uint64_t j = 0; j < nrowsBatch; ++j) {",
        "                    uint64_t l = (i + j + nextStrides[o]) % domainSize;",
        "                    bufferT[nrowsBatch*o + j] = ((Goldilocks::Element *)constPols->address())[l * nColsSteps[0] + id];",
        "                }",
        "                Goldilocks::load_avx(bufferT_[nOpenings * id + o], &bufferT[nrowsBatch*o]);",
        "            }",
        "        }\n",
        "        for(uint64_t k = 0; k < parserParams.nCmPolsUsed; ++k) {",
        "            uint64_t polId = cmPolsUsed[k];",
        "            PolMap polInfo = starkInfo.cmPolsMap[polId];",
        `            bool isTmpPol = polInfo.stage == string("tmpExp") && !domainExtended;`,
        `            uint64_t stage = isTmpPol ? nStages + 1 : polInfo.stageNum;`,
        "            uint64_t stagePos = polInfo.stagePos;",
        "            uint64_t dim = polInfo.dim;",
        "            for(uint64_t d = 0; d < polInfo.dim; ++d) {",
        "                for(uint64_t o = 0; o < nOpenings; ++o) {",
        "                    for(uint64_t j = 0; j < nrowsBatch; ++j) {",
        "                        uint64_t l = (i + j + nextStrides[o]) % domainSize;",
        "                        if(isTmpPol) {",
        "                            bufferT[nrowsBatch*o + j] = params.pols[offsetsSteps[stage] + stagePos * domainSize + l*dim + d];",
        "                        } else {",
        "                            bufferT[nrowsBatch*o + j] = params.pols[offsetsSteps[stage] + l * nColsSteps[stage] + stagePos + d];",
        "                        }",
        "                    }",
        "                    Goldilocks::load_avx(bufferT_[nOpenings * nColsStepsAccumulated[stage] + nOpenings * (stagePos + d) + o], &bufferT[nrowsBatch*o]);",
        "                }",
        "            }",  
        "        }",   
    ]);
    
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
            } else if(op.src1_type) {
                operationDescription = `                // OPERATION WITH DEST: ${op.dest_type} - SRC0: ${op.src0_type} - SRC1: ${op.src1_type}`;
            } else {
                operationDescription = `                // COPY ${op.src0_type} to ${op.dest_type}`;
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
        "        if (parserParams.destDim != 0) {",
        "            if(parserParams.destDim == 1) {",
        "                Goldilocks::Element res[4];",
        "                Goldilocks::store_avx(res, tmp1[parserParams.destId]);",
        "                for(uint64_t j = 0; j < 4; ++j) {",
        "                    if(i + j < parserParams.firstRow) continue;",
        "                    if(i + j >= parserParams.lastRow) break;",
        "                    if(!Goldilocks::isZero(res[j])) {",
        "                        validConstraint[i + j] = false;",
        "                    }",
        "                }",
        "            } else if(parserParams.destDim == 3) {",
        "                Goldilocks::Element res[12];",
        "                Goldilocks::store_avx(&res[0], tmp3[parserParams.destId][0]);",
        "                Goldilocks::store_avx(&res[4], tmp3[parserParams.destId][1]);",
        "                Goldilocks::store_avx(&res[8], tmp3[parserParams.destId][2]);",
        "                for(uint64_t j = 0; j < 4; ++j) {",
        "                    if(i + j < parserParams.firstRow) continue;",
        "                    if(i + j >= parserParams.lastRow) break;",
        "                    for(uint64_t k = 0; k < 3; ++k) {",
        "                        if(!Goldilocks::isZero(res[3*j + k])) {",
        "                            validConstraint[i + j] = false;",
        "                        }",
        "                    }",
        "                }",
        "            } ",
        "        }",
    ]);

    parserCPP.push(...[
        `        if (i_args != parserParams.nArgs) std::cout << " " << i_args << " - " << parserParams.nArgs << std::endl;`,
        "        assert(i_args == parserParams.nArgs);",
        "    }"
    ]);

    parserCPP.push(...[
        "    if(parserParams.destDim != 0) {",
        "        bool isValidConstraint = true;",
        "        uint64_t nInvalidRows = 0;",
        "        uint64_t maxInvalidRowsDisplay = 100;",
        "        for(uint64_t i = 0; i < domainSize; ++i) {",
        "            if(!validConstraint[i]) {",
        "                isValidConstraint = false;",
        "                if(nInvalidRows < maxInvalidRowsDisplay) {",
        "                    cout << \"Constraint check failed at \" << i << endl;",
        "                    nInvalidRows++;",
        "                } else {",
        "                    cout << \"There are more than \" << maxInvalidRowsDisplay << \" invalid rows\" << endl;",
        "                    break;",
        "                }",
        "            }",
        "        }",
        "        if(isValidConstraint) {",
        "            TimerLog(CONSTRAINT_CHECKS_PASSED);",
        "        } else {",
        "            TimerLog(CONSTRAINT_CHECKS_FAILED);",
        "        }",
        "    }"
    ]);

    parserCPP.push("}");
       
    
    const parserCPPCode = parserCPP.map(l => `    ${l}`).join("\n");

    return parserCPPCode;

    function writeOperation(operation) {
        if(operation.dest_type === "q") {
            const qOperation = [
                "                Goldilocks::Element tmp_inv[3];",
                "                Goldilocks::Element ti0[4];",
                "                Goldilocks::Element ti1[4];",
                "                Goldilocks::Element ti2[4];",
                `                Goldilocks::store_avx(ti0, tmp3[args[i_args]][0]);`,
                `                Goldilocks::store_avx(ti1, tmp3[args[i_args]][1]);`,
                `                Goldilocks::store_avx(ti2, tmp3[args[i_args]][2]);`,
                "                for (uint64_t j = 0; j < AVX_SIZE_; ++j) {",
                "                    tmp_inv[0] = ti0[j];",
                "                    tmp_inv[1] = ti1[j];",
                "                    tmp_inv[2] = ti2[j];",
                "                    Goldilocks3::mul((Goldilocks3::Element &)(params.q_2ns[(i + j) * FIELD_EXTENSION]), params.zi[i + j],(Goldilocks3::Element &)tmp_inv);",
                "                }",
            ].join("\n");
            return qOperation;
        }
        let name = ["tmp1", "commit1"].includes(operation.dest_type) ? "Goldilocks::" : "Goldilocks3::";
        
        if(operation.op === "mul") {
            name += "mul";
        } else if (operation.src1_type) {
            name += "op";
        } else {
            name += "copy";
        }

        if(["tmp3", "commit3"].includes(operation.dest_type)) {
            if(operation.src1_type)  {
                let dimType = "";
                let dims1 = ["public", "x", "commit1", "tmp1", "const", "number", "Zi"];
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

        if(operation.dest_type === "commit1" || operation.dest_type === "commit3") {
            operationStoreAvx = `                storePolinomial(params.pols, bufferT_, nColsSteps, offsetsSteps, buffTOffsetsSteps_, nextStrides, nOpenings, domainSize, domainExtended, nStages, needModule, i, args[i_args + ${c_args}], args[i_args + ${c_args + 1}], args[i_args + ${c_args + 2}], ${operation.dest_type === "commit1" ? 1 : "FIELD_EXTENSION"});`;
        } else if(operation.dest_type === "f") {
            operationStoreAvx = `                Goldilocks3::store_avx(&params.f_2ns[i*FIELD_EXTENSION], uint64_t(FIELD_EXTENSION), tmp3_);`;
        }


        c_args += numberOfArgs(operation.dest_type);

        let typeSrc0 = writeType(operation.src0_type);
        c_args += numberOfArgs(operation.src0_type);

        let typeSrc1;

        const operationCall = [];

        if ("x" === operation.src0_type){
            operationCall.push(`                Goldilocks::load_avx(tmp1_0, ${typeSrc0}, uint64_t(1));`);
            typeSrc0 = "tmp1_0";
        } else if(["xDivXSubXi"].includes(operation.src0_type)) {
            operationCall.push(`                Goldilocks3::load_avx(tmp3_0, ${typeSrc0}, uint64_t(FIELD_EXTENSION));`);
            typeSrc0 = "tmp3_0";
        } 

        if(operation.src1_type) {
            typeSrc1 = writeType(operation.src1_type);

            if ("x" === operation.src1_type){
                operationCall.push(`                Goldilocks::load_avx(tmp1_1, ${typeSrc1}, uint64_t(1));`);
                typeSrc1 = "tmp1_1";
            } else if("Zi" === operation.src1_type) {
                operationCall.push(`                Goldilocks::load_avx(tmp1_1, ${typeSrc1}, uint64_t(1));`);
                typeSrc1 = "tmp1_1";
            } else if("xDivXSubXi" === operation.src1_type) {
                operationCall.push(`                Goldilocks3::load_avx(tmp3_1, ${typeSrc1}, uint64_t(FIELD_EXTENSION));`);
                typeSrc1 = "tmp3_1";
            }

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
                return `bufferT_[buffTOffsetsSteps_[args[i_args + ${c_args}]] + nOpenings * args[i_args + ${c_args + 1}] + args[i_args + ${c_args + 2}]]`;
            case "challenge":
                return `challenges[args[i_args + ${c_args}]]`;
            case "eval":
                return `evals[args[i_args + ${c_args}]]`;
            case "subproofValue":
                return `subproofValues[args[i_args + ${c_args}]]`;
            case "number":
                return `numbers_[args[i_args + ${c_args}]]`;
            case "x":
                return `&x[i]`;
            case "xDivXSubXi": 
                return `&params.xDivXSubXi[(i + args[i_args + ${c_args}]*domainSize)*FIELD_EXTENSION]`;
            case "f":
                return "&params.f_2ns[i*FIELD_EXTENSION]";
            case "Zi": 
                return `&params.zi[i + args[i_args + ${c_args}] * domainSize]`;
            default:
                throw new Error("Invalid type: " + type);
        }
    }

    function numberOfArgs(type) {
        switch (type) {
            case "x":
            case "q":
            case "f":
                return 0; 
            case "public":            
            case "tmp1":
            case "tmp3":
            case "challenge":
            case "eval":
            case "subproofValue":
            case "number":
            case "xDivXSubXi":
            case "Zi":
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

    const possibleSrcDim1 = [ "commit1", "tmp1", "public", "x", "number" ];
    const possibleSrcDim3 = [ "commit3", "tmp3", "challenge", "subproofValue" ];

    // Dim1 destinations
    for(let j = 0; j < possibleDestinationsDim1.length; j++) {
        let dest_type = possibleDestinationsDim1[j];
        for(let k = 0; k < possibleSrcDim1.length; ++k) {
            let src0_type = possibleSrcDim1[k];
            possibleOps.push({dest_type, src0_type}); // Copy operation
            if(src0_type === "x") continue;
            for (let l = k; l < possibleSrcDim1.length; ++l) {
                let src1_type = possibleSrcDim1[l];
                if(src1_type === "x") continue;
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
            if(["commit3", "tmp3"].includes(src0_type)) possibleOps.push({dest_type, src0_type}); // Copy operation
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

    // Step Q
    possibleOps.push({ dest_type: "tmp1", src0_type: "tmp1", src1_type: "Zi"});
    possibleOps.push({ dest_type: "tmp1", src0_type: "commit1", src1_type: "Zi"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "tmp3", src1_type: "Zi"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "commit3", src1_type: "Zi"});


    // Step FRI
    possibleOps.push({ dest_type: "tmp3", src0_type: "eval"});
    possibleOps.push({ op: "mul", dest_type: "tmp3", src0_type: "eval", src1_type: "challenge"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "challenge", src1_type: "eval"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "tmp3", src1_type: "eval"});

    possibleOps.push({ dest_type: "tmp3", src0_type: "eval", src1_type: "commit1"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "commit3", src1_type: "eval"});
    
    possibleOps.push({ dest_type: "tmp3", src0_type: "tmp3", src1_type: "xDivXSubXi"});

    possibleOps.push({ dest_type: "q", src0_type: "tmp3", src1_type: "Zi"});
    possibleOps.push({ dest_type: "f", src0_type: "tmp3", src1_type: "tmp3"});

    return possibleOps;
}

module.exports.getOperation = function getOperation(r) {
    const _op = {};
    _op.op = r.op;
    if(["cm", "tmpExp"].includes(r.dest.type)) {
        _op.dest_type = `commit${r.dest.dim}`;
    } else if(r.dest.type === "tmp") {
        _op.dest_type = `tmp${r.dest.dim}`;
    } else {
        _op.dest_type = r.dest.type;
    }
    
    let src = [...r.src];
    if(r.op !== "copy") {
        src.sort((a, b) => {
            let opA =  ["cm", "tmpExp"].includes(a.type) ? operationsMap[`commit${a.dim}`] : a.type === "tmp" ? operationsMap[`tmp${a.dim}`] : operationsMap[a.type];
            let opB = ["cm", "tmpExp"].includes(b.type) ? operationsMap[`commit${b.dim}`] : b.type === "tmp" ? operationsMap[`tmp${b.dim}`] : operationsMap[b.type];
            let swap = a.dim !== b.dim ? b.dim - a.dim : opA - opB;
            if(r.op === "sub" && swap < 0) _op.op = "sub_swap";
            return swap;
        });
    }

    for(let i = 0; i < src.length; i++) {
        if(["cm", "tmpExp"].includes(src[i].type)) {
            _op[`src${i}_type`] = `commit${src[i].dim}`;
        } else if(src[i].type === "const") {
            _op[[`src${i}_type`]] = "commit1";
        } else if(src[i].type === "tmp") {
            _op[`src${i}_type`] =  `tmp${src[i].dim}`;
        } else {
            _op[`src${i}_type`] = src[i].type;
        }
    }

    _op.src = src;
    
    return _op;
}