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

module.exports.generateParser = function generateParser(parserType = "avx") {

    let operations = getAllOperations();

    let c_args = 0;
    
    if(!["avx", "avx512", "pack"].includes(parserType)) throw new Error("Invalid parser type");

    let isAvx = ["avx", "avx512"].includes(parserType);

    let avxTypeElement;
    let avxTypeExtElement;
    let avxSet1Epi64;
    let avxLoad;
    let avxStore;

    if(isAvx) {
        avxTypeElement = parserType === "avx" ? "__m256i" : "__m512i";
        avxTypeExtElement = parserType === "avx" ? "Goldilocks3::Element_avx" : "Goldilocks3::Element_avx512";
        avxSet1Epi64 = parserType === "avx" ? "_mm256_set1_epi64x" : "_mm512_set1_epi64";
        avxLoad = parserType === "avx" ? "load_avx" : "load_avx512";
        avxStore = parserType === "avx" ? "store_avx" : "store_avx512";
    }

    const parserCPP = [];

    if(parserType === "avx") {
        parserCPP.push("uint64_t nrowsPack = 4;");
    } else if (parserType === "avx512") {
        parserCPP.push("uint64_t nrowsPack = 8;");
    } else {
        parserCPP.push("uint64_t nrowsPack = 4;");
    }

    parserCPP.push(...[
        "uint64_t nCols;",
        "vector<uint64_t> nColsStages;",
        "vector<uint64_t> nColsStagesAcc;",
        "vector<uint64_t> offsetsStages;",
    ]);

    const expressionsClassName = parserType === "avx" ? `ExpressionsAvx` : parserType === "avx512" ? "ExpressionsAvx512" : "ExpressionsPack";

    parserCPP.push(`${expressionsClassName}(SetupCtx& setupCtx) : ExpressionsCtx(setupCtx) {};\n`);

    parserCPP.push(...[
        `void setBufferTInfo(uint64_t stage, bool domainExtended, uint64_t expId, bool prover_initialized) {`,
        "    uint64_t nOpenings = setupCtx.starkInfo.openingPoints.size();",
        `    offsetsStages.resize((setupCtx.starkInfo.nStages + 2)*nOpenings + 1);`,
        `    nColsStages.resize((setupCtx.starkInfo.nStages + 2)*nOpenings + 1);`,
        `    nColsStagesAcc.resize((setupCtx.starkInfo.nStages + 2)*nOpenings + 1);\n`,
        `    nCols = setupCtx.starkInfo.nConstants;`,
        `    uint64_t ns = !prover_initialized ? 1 : setupCtx.starkInfo.nStages + 2;`,
        `    for(uint64_t o = 0; o < nOpenings; ++o) {`,
        `        for(uint64_t stage = 0; stage <= ns; ++stage) {`,
        `            std::string section = stage == 0 ? "const" : "cm" + to_string(stage);`,
        `            offsetsStages[(setupCtx.starkInfo.nStages + 2)*o + stage] = !prover_initialized ? 0 : setupCtx.starkInfo.mapOffsets[std::make_pair(section, domainExtended)];`,
        `            nColsStages[(setupCtx.starkInfo.nStages + 2)*o + stage] = setupCtx.starkInfo.mapSectionsN[section];`,
        `            nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*o + stage] = stage == 0 && o == 0 ? 0 : nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*o + stage - 1] + nColsStages[stage - 1];`,
        `        }`,
        `    }\n`,
        "    if(expId == setupCtx.starkInfo.cExpId || expId == setupCtx.starkInfo.friExpId) {",
        "        nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] = nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings - 1] + nColsStages[(setupCtx.starkInfo.nStages + 2)*nOpenings - 1];",
        "        if(expId == setupCtx.starkInfo.cExpId) {",
        "            nCols = nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + setupCtx.starkInfo.boundaries.size();",
        "        } else {",
        "            nCols = nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + nOpenings*FIELD_EXTENSION;",
        "        }",
        "    } else {",
        "        nCols = nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings - 1] + nColsStages[(setupCtx.starkInfo.nStages + 2)*nOpenings - 1];",
        "    }",
        "}\n",
    ]);
    
    if(isAvx) {
        parserCPP.push(...[
            `inline void loadPolynomials(StepsParams& params, ParserArgs &parserArgs, ParserParams &parserParams, ${avxTypeElement} *bufferT_, uint64_t row, bool domainExtended) {`,
            "    uint64_t nOpenings = setupCtx.starkInfo.openingPoints.size();",
            "    uint64_t domainSize = domainExtended ? 1 << setupCtx.starkInfo.starkStruct.nBitsExt : 1 << setupCtx.starkInfo.starkStruct.nBits;\n",
            "    uint64_t extendBits = (setupCtx.starkInfo.starkStruct.nBitsExt - setupCtx.starkInfo.starkStruct.nBits);",
            "    int64_t extend = domainExtended ? (1 << extendBits) : 1;",
            "    uint64_t nextStrides[nOpenings];",
            "    for(uint64_t i = 0; i < nOpenings; ++i) {",
            "        uint64_t opening = setupCtx.starkInfo.openingPoints[i] < 0 ? setupCtx.starkInfo.openingPoints[i] + domainSize : setupCtx.starkInfo.openingPoints[i];",
            "        nextStrides[i] = opening * extend;",
            "    }\n",
            "    Goldilocks::Element *constPols = domainExtended ? setupCtx.constPols.pConstPolsAddressExtended : setupCtx.constPols.pConstPolsAddress;\n",
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
            `            Goldilocks::${avxLoad}(bufferT_[nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*o] + id], &bufferT[nrowsPack*o]);`,
            "        }",
            "    }\n",
            "    for(uint64_t k = 0; k < parserParams.nCmPolsUsed; ++k) {",
            "        uint64_t polId = cmPolsUsed[k];",
            "        PolMap polInfo = setupCtx.starkInfo.cmPolsMap[polId];",
            "        uint64_t stage = polInfo.stage;",
            "        uint64_t stagePos = polInfo.stagePos;",
            "        for(uint64_t d = 0; d < polInfo.dim; ++d) {",
            "            for(uint64_t o = 0; o < nOpenings; ++o) {",
            "                for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "                    uint64_t l = (row + j + nextStrides[o]) % domainSize;",
            "                    bufferT[nrowsPack*o + j] = params.pols[offsetsStages[stage] + l * nColsStages[stage] + stagePos + d];",
            "                }",
            `                Goldilocks::${avxLoad}(bufferT_[nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*o + stage] + (stagePos + d)], &bufferT[nrowsPack*o]);`,
            "            }",
            "        }",
            "    }\n",
            "    if(parserParams.expId == setupCtx.starkInfo.cExpId) {",
            "        for(uint64_t d = 0; d < setupCtx.starkInfo.boundaries.size(); ++d) {",
            "            for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "                bufferT[j] = setupCtx.constPols.zi[row + j + d*domainSize];",
            "            }",
            `            Goldilocks::${avxLoad}(bufferT_[nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + d], &bufferT[0]);`,
            "        }",
            "    } else if(parserParams.expId == setupCtx.starkInfo.friExpId) {",
            "        for(uint64_t d = 0; d < setupCtx.starkInfo.openingPoints.size(); ++d) {",
            "           for(uint64_t k = 0; k < FIELD_EXTENSION; ++k) {",
            "                for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `                    bufferT[j] = params.pols[setupCtx.starkInfo.mapOffsets[std::make_pair("xDivXSubXi", true)] + (row + j + d*domainSize)*FIELD_EXTENSION + k];`,
            "                }",
            `                Goldilocks::${avxLoad}(bufferT_[nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + d*FIELD_EXTENSION + k], &bufferT[0]);`,
            "            }",
            "        }",
            "    }",
            "}\n",
        ])
    } else {
        parserCPP.push(...[
            `inline void loadPolynomials(StepsParams& params, ParserArgs &parserArgs, ParserParams &parserParams, Goldilocks::Element *bufferT_, uint64_t row, bool domainExtended) {`,
            "    uint64_t nOpenings = setupCtx.starkInfo.openingPoints.size();",
            "    uint64_t domainSize = domainExtended ? 1 << setupCtx.starkInfo.starkStruct.nBitsExt : 1 << setupCtx.starkInfo.starkStruct.nBits;\n",
            "    uint64_t extendBits = (setupCtx.starkInfo.starkStruct.nBitsExt - setupCtx.starkInfo.starkStruct.nBits);",
            "    int64_t extend = domainExtended ? (1 << extendBits) : 1;",
            "    uint64_t nextStrides[nOpenings];",
            "    for(uint64_t i = 0; i < nOpenings; ++i) {",
            "        uint64_t opening = setupCtx.starkInfo.openingPoints[i] < 0 ? setupCtx.starkInfo.openingPoints[i] + domainSize : setupCtx.starkInfo.openingPoints[i];",
            "        nextStrides[i] = opening * extend;",
            "    }\n",
            "    Goldilocks::Element *constPols = domainExtended ? setupCtx.constPols.pConstPolsAddressExtended : setupCtx.constPols.pConstPolsAddress;\n",
            "    uint16_t* cmPolsUsed = &parserArgs.cmPolsIds[parserParams.cmPolsOffset];",
            "    uint16_t* constPolsUsed = &parserArgs.constPolsIds[parserParams.constPolsOffset];\n",
            "    for(uint64_t k = 0; k < parserParams.nConstPolsUsed; ++k) {",
            "        uint64_t id = constPolsUsed[k];",
            "        for(uint64_t o = 0; o < nOpenings; ++o) {",
            "            for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "                uint64_t l = (row + j + nextStrides[o]) % domainSize;",
            "                bufferT_[(nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*o] + id)*nrowsPack + j] = constPols[l * nColsStages[0] + id];",
            "            }",
            "        }",
            "    }\n",
            "    for(uint64_t k = 0; k < parserParams.nCmPolsUsed; ++k) {",
            "        uint64_t polId = cmPolsUsed[k];",
            "        PolMap polInfo = setupCtx.starkInfo.cmPolsMap[polId];",
            "        uint64_t stage = polInfo.stage;",
            "        uint64_t stagePos = polInfo.stagePos;",
            "        for(uint64_t d = 0; d < polInfo.dim; ++d) {",
            "            for(uint64_t o = 0; o < nOpenings; ++o) {",
            "                for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "                    uint64_t l = (row + j + nextStrides[o]) % domainSize;",
            "                    bufferT_[(nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*o + stage] + (stagePos + d))*nrowsPack + j] = params.pols[offsetsStages[stage] + l * nColsStages[stage] + stagePos + d];",
            "                }",
            "            }",
            "        }",
            "    }\n",
            "    if(parserParams.expId == setupCtx.starkInfo.cExpId) {",
            "        for(uint64_t d = 0; d < setupCtx.starkInfo.boundaries.size(); ++d) {",
            "            for(uint64_t j = 0; j < nrowsPack; ++j) {",
            "                bufferT_[(nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + d)*nrowsPack + j] = setupCtx.constPols.zi[row + j + d*domainSize];",
            "            }",
            "        }",
            "    } else if(parserParams.expId == setupCtx.starkInfo.friExpId) {",
            "        for(uint64_t d = 0; d < setupCtx.starkInfo.openingPoints.size(); ++d) {",
            "           for(uint64_t k = 0; k < FIELD_EXTENSION; ++k) {",
            "                for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `                    bufferT_[(nColsStagesAcc[(setupCtx.starkInfo.nStages + 2)*nOpenings] + d*FIELD_EXTENSION + k)*nrowsPack + j] = params.pols[setupCtx.starkInfo.mapOffsets[std::make_pair("xDivXSubXi", true)] + (row + j + d*domainSize)*FIELD_EXTENSION + k];`,
            "                }",
            "            }",
            "        }",
            "    }",
            "}\n",
        ])
    }
    

    parserCPP.push(...[
        `inline void storePolynomial(Goldilocks::Element* dest, ParserParams& parserParams, uint64_t row, ${isAvx ? avxTypeElement : "Goldilocks::Element"}* tmp1, ${isAvx ? avxTypeExtElement : "Goldilocks::Element"}* tmp3, bool inverse) {`,
        "    if(parserParams.destDim == 1) {",
        `        Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&dest[row], ${!isAvx ? "&tmp1[parserParams.destId*nrowsPack]" : "tmp1[parserParams.destId]"});`,
        "        if(inverse) {",
        "            for(uint64_t i = 0; i < nrowsPack; ++i) {",
        "                Goldilocks::inv(dest[row + i], dest[row + i]);",
        "            }",
        "        }",
        "    } else {",
        `        Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&dest[row*FIELD_EXTENSION], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&tmp3[parserParams.destId*FIELD_EXTENSION*nrowsPack]" : "tmp3[parserParams.destId][0]"});`,
        `        Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&dest[row*FIELD_EXTENSION + 1], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&tmp3[(parserParams.destId*FIELD_EXTENSION + 1)*nrowsPack]" : "tmp3[parserParams.destId][1]"});`,
        `        Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&dest[row*FIELD_EXTENSION + 2], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&tmp3[(parserParams.destId*FIELD_EXTENSION + 2)*nrowsPack]" : "tmp3[parserParams.destId][2]"});`,
        "        if(inverse) {",
        "            for(uint64_t i = 0; i < nrowsPack; ++i) {",
        "                Goldilocks3::inv((Goldilocks3::Element *)&dest[(row + i)*FIELD_EXTENSION], (Goldilocks3::Element *)&dest[(row + i)*FIELD_EXTENSION]);",
        "            }",
        "        }",
        "    }",
        "}\n",
    ]);

    parserCPP.push(...[
        `inline void printTmp1(uint64_t row, ${isAvx ? avxTypeElement : "Goldilocks::Element*"} tmp) {`,
        "    Goldilocks::Element dest[nrowsPack];",
        `    Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}dest, tmp);`,
        "    for(uint64_t i = 0; i < 1; ++i) {",
        `        cout << "Value at row " << row + i << " is " << Goldilocks::toString(dest[i]) << endl;`,
        "    }",
        "}\n"
    ]);
    
    parserCPP.push(...[
        `inline void printTmp3(uint64_t row, ${isAvx ? avxTypeExtElement : "Goldilocks::Element*"} tmp) {`,
        "    Goldilocks::Element dest[FIELD_EXTENSION*nrowsPack];",
        `    Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&dest[0], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&tmp[0]" : "tmp[0]"});`,
        `    Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&dest[1], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&tmp[1]" : "tmp[1]"});`,
        `    Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&dest[2], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&tmp[2]" : "tmp[2]"});`,
        "    for(uint64_t i = 0; i < 1; ++i) {",
        `        cout << "Value at row " << row + i << " is [" << Goldilocks::toString(dest[FIELD_EXTENSION*i]) << ", " << Goldilocks::toString(dest[FIELD_EXTENSION*i + 1]) << ", " << Goldilocks::toString(dest[FIELD_EXTENSION*i + 2]) << "]" << endl;`,
        "    }",
        "}\n",
    ]);
    
    parserCPP.push(...[
        `inline void printCommit(uint64_t row, ${isAvx ? avxTypeElement : "Goldilocks::Element"}* bufferT, bool extended) {`,
        "    if(extended) {",
        "        Goldilocks::Element dest[FIELD_EXTENSION*nrowsPack];",
        `        Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&dest[0], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&bufferT[0]" : "bufferT[0]"});`,
        `        Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&dest[1], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&bufferT[setupCtx.starkInfo.openingPoints.size()]" : "bufferT[setupCtx.starkInfo.openingPoints.size()]"});`,
        `        Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&dest[2], uint64_t(FIELD_EXTENSION), ${!isAvx ? "&bufferT[2*setupCtx.starkInfo.openingPoints.size()]" : "bufferT[2*setupCtx.starkInfo.openingPoints.size()]"});`,
        "        for(uint64_t i = 0; i < 1; ++i) {",
        `            cout << "Value at row " << row + i << " is [" << Goldilocks::toString(dest[FIELD_EXTENSION*i]) << ", " << Goldilocks::toString(dest[FIELD_EXTENSION*i + 1]) << ", " << Goldilocks::toString(dest[FIELD_EXTENSION*i + 2]) << "]" << endl;`,
        "        }",
        "    } else {",
        "        Goldilocks::Element dest[nrowsPack];",
        `        Goldilocks::${isAvx ? avxStore : "copy_pack"}(${!isAvx ? "nrowsPack, " : ""}&dest[0], ${!isAvx ? "&bufferT[0]" : "bufferT[0]"});`,
        "        for(uint64_t i = 0; i < 1; ++i) {",
        `            cout << "Value at row " << row + i << " is " << Goldilocks::toString(dest[i]) << endl;`,
        "        }",
        "    }",
        "}\n",
    ]);
    
    parserCPP.push(...[
        `void calculateExpressions(StepsParams& params, Goldilocks::Element *dest, ParserArgs &parserArgs, ParserParams &parserParams, bool domainExtended, bool inverse) override {\n`,
        "    uint8_t* ops = &parserArgs.ops[parserParams.opsOffset];",
        "    uint16_t* args = &parserArgs.args[parserParams.argsOffset];",
        "    uint64_t* numbers = &parserArgs.numbers[parserParams.numbersOffset];\n",
        "    uint64_t nOpenings = setupCtx.starkInfo.openingPoints.size();",
        "    uint64_t domainSize = domainExtended ? 1 << setupCtx.starkInfo.starkStruct.nBitsExt : 1 << setupCtx.starkInfo.starkStruct.nBits;\n",
    ]);

    parserCPP.push("    setBufferTInfo(parserParams.stage, domainExtended, parserParams.expId, params.prover_initialized);\n")
      
    if(isAvx) {
        parserCPP.push(...[
            `    ${avxTypeExtElement} challenges[setupCtx.starkInfo.challengesMap.size()];`,
            `    ${avxTypeExtElement} challenges_ops[setupCtx.starkInfo.challengesMap.size()];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.challengesMap.size(); ++i) {",
            `        challenges[i][0] = ${avxSet1Epi64}(params.challenges[i * FIELD_EXTENSION].fe);`,
            `        challenges[i][1] = ${avxSet1Epi64}(params.challenges[i * FIELD_EXTENSION + 1].fe);`,
            `        challenges[i][2] = ${avxSet1Epi64}(params.challenges[i * FIELD_EXTENSION + 2].fe);\n`,
            "        Goldilocks::Element challenges_aux[3];",
            "        challenges_aux[0] = params.challenges[i * FIELD_EXTENSION] + params.challenges[i * FIELD_EXTENSION + 1];",
            "        challenges_aux[1] = params.challenges[i * FIELD_EXTENSION] + params.challenges[i * FIELD_EXTENSION + 2];",
            "        challenges_aux[2] = params.challenges[i * FIELD_EXTENSION + 1] + params.challenges[i * FIELD_EXTENSION + 2];",
            `        challenges_ops[i][0] = ${avxSet1Epi64}(challenges_aux[0].fe);`,
            `        challenges_ops[i][1] =  ${avxSet1Epi64}(challenges_aux[1].fe);`,
            `        challenges_ops[i][2] =  ${avxSet1Epi64}(challenges_aux[2].fe);`,
            "    }\n",
        ]);

        parserCPP.push(...[
            `    ${avxTypeElement} numbers_[parserParams.nNumbers];`,
            "    for(uint64_t i = 0; i < parserParams.nNumbers; ++i) {",
            `        numbers_[i] = ${avxSet1Epi64}(numbers[i]);`,
            "    }\n",
        ])
    
        parserCPP.push(...[
            `    ${avxTypeElement} publics[setupCtx.starkInfo.nPublics];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.nPublics; ++i) {",
            `        publics[i] = ${avxSet1Epi64}(params.publicInputs[i].fe);`,
            "    }\n",
        ]);
    
        parserCPP.push(...[
            `    ${avxTypeExtElement} subproofValues[setupCtx.starkInfo.nSubProofValues];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.nSubProofValues; ++i) {",
            `        subproofValues[i][0] = ${avxSet1Epi64}(params.subproofValues[i * FIELD_EXTENSION].fe);`,
            `        subproofValues[i][1] = ${avxSet1Epi64}(params.subproofValues[i * FIELD_EXTENSION + 1].fe);`,
            `        subproofValues[i][2] = ${avxSet1Epi64}(params.subproofValues[i * FIELD_EXTENSION + 2].fe);`,
            "    }\n",
        ]);
    
        parserCPP.push(...[
            `    ${avxTypeExtElement} evals[setupCtx.starkInfo.evMap.size()];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.evMap.size(); ++i) {",
            `        evals[i][0] = ${avxSet1Epi64}(params.evals[i * FIELD_EXTENSION].fe);`,
            `        evals[i][1] = ${avxSet1Epi64}(params.evals[i * FIELD_EXTENSION + 1].fe);`,
            `        evals[i][2] = ${avxSet1Epi64}(params.evals[i * FIELD_EXTENSION + 2].fe);`,
            "    }\n",
        ]);

    } else {
        parserCPP.push(...[
            `    Goldilocks::Element challenges[setupCtx.starkInfo.challengesMap.size()*FIELD_EXTENSION*nrowsPack];`,
            `    Goldilocks::Element challenges_ops[setupCtx.starkInfo.challengesMap.size()*FIELD_EXTENSION*nrowsPack];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.challengesMap.size(); ++i) {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `            challenges[(i*FIELD_EXTENSION)*nrowsPack + j] = params.challenges[i * FIELD_EXTENSION];`,
            `            challenges[(i*FIELD_EXTENSION + 1)*nrowsPack + j] = params.challenges[i * FIELD_EXTENSION + 1];`,
            `            challenges[(i*FIELD_EXTENSION + 2)*nrowsPack + j] = params.challenges[i * FIELD_EXTENSION + 2];`,
            "            challenges_ops[(i*FIELD_EXTENSION)*nrowsPack + j] = params.challenges[i * FIELD_EXTENSION] + params.challenges[i * FIELD_EXTENSION + 1];",
            "            challenges_ops[(i*FIELD_EXTENSION + 1)*nrowsPack + j] = params.challenges[i * FIELD_EXTENSION] + params.challenges[i * FIELD_EXTENSION + 2];",
            "            challenges_ops[(i*FIELD_EXTENSION + 2)*nrowsPack + j] = params.challenges[i * FIELD_EXTENSION + 1] + params.challenges[i * FIELD_EXTENSION + 2];",
            "        }",
            "    }\n",
        ]);

        parserCPP.push(...[
            "    Goldilocks::Element numbers_[parserParams.nNumbers*nrowsPack];",
            "    for(uint64_t i = 0; i < parserParams.nNumbers; ++i) {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `            numbers_[i*nrowsPack + j] = Goldilocks::fromU64(numbers[i]);`,
            "        }",
            "    }\n",
        ])

        parserCPP.push(...[
            "    Goldilocks::Element publics[setupCtx.starkInfo.nPublics*nrowsPack];",
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.nPublics; ++i) {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `            publics[i*nrowsPack + j] = params.publicInputs[i];`,
            "        }",
            "    }\n",
        ])

        parserCPP.push(...[
            `    Goldilocks::Element evals[setupCtx.starkInfo.evMap.size()*FIELD_EXTENSION*nrowsPack];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.evMap.size(); ++i) {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `            evals[(i*FIELD_EXTENSION)*nrowsPack + j] = params.evals[i * FIELD_EXTENSION];`,
            `            evals[(i*FIELD_EXTENSION + 1)*nrowsPack + j] = params.evals[i * FIELD_EXTENSION + 1];`,
            `            evals[(i*FIELD_EXTENSION + 2)*nrowsPack + j] = params.evals[i * FIELD_EXTENSION + 2];`,
            "        }",
            "    }\n",
        ]);

        parserCPP.push(...[
            `    Goldilocks::Element subproofValues[setupCtx.starkInfo.nSubProofValues*FIELD_EXTENSION*nrowsPack];`,
            "    for(uint64_t i = 0; i < setupCtx.starkInfo.nSubProofValues; ++i) {",
            "        for(uint64_t j = 0; j < nrowsPack; ++j) {",
            `            subproofValues[(i*FIELD_EXTENSION)*nrowsPack + j] = params.subproofValues[i * FIELD_EXTENSION];`,
            `            subproofValues[(i*FIELD_EXTENSION + 1)*nrowsPack + j] = params.subproofValues[i * FIELD_EXTENSION + 1];`,
            `            subproofValues[(i*FIELD_EXTENSION + 2)*nrowsPack + j] = params.subproofValues[i * FIELD_EXTENSION + 2];`,
            "        }",
            "    }\n",
        ]);
    }

    parserCPP.push(...[
        `#pragma omp parallel for`,
        `    for (uint64_t i = 0; i < domainSize; i+= nrowsPack) {`,
        "        uint64_t i_args = 0;\n",
    ]);

    if(isAvx) {
        parserCPP.push(...[
            `        ${avxTypeElement} bufferT_[nOpenings*nCols];`,
            `        ${avxTypeElement} tmp1[parserParams.nTemp1];`,
            `        ${avxTypeExtElement} tmp3[parserParams.nTemp3];\n`,
        ]); 
    } else {
        parserCPP.push(...[
            `        Goldilocks::Element bufferT_[nOpenings*nCols*nrowsPack];`,
            `        Goldilocks::Element tmp1[parserParams.nTemp1*nrowsPack];`,
            `        Goldilocks::Element tmp3[parserParams.nTemp3*nrowsPack*FIELD_EXTENSION];\n`,
        ]);
    }
    

    parserCPP.push("        loadPolynomials(params, parserArgs, parserParams, bufferT_, i, domainExtended);\n");
    
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
        
        if(parserType === "avx") {
            name += "_avx(";
        } else if(parserType === "avx512") {
            name += "_avx512(";
        } else if(parserType === "pack") {
            name += "_pack(nrowsPack, ";
        }

        c_args = 0;

        if(!operation.op) {
            name += `args[i_args + ${c_args}], `;
        }
        c_args++;

        let typeDest = writeType(operation.dest_type, c_args, parserType);
        c_args += numberOfArgs(operation.dest_type);

        let typeSrc0 = writeType(operation.src0_type, c_args, parserType);
        c_args += numberOfArgs(operation.src0_type);

        let typeSrc1 = writeType(operation.src1_type, c_args, parserType);
        c_args += numberOfArgs(operation.src1_type);

        const operationCall = [];

        name += typeDest + ", ";
        name += typeSrc0 + ", ";
        if(operation.op === "mul" && operation.src1_type === "challenge") {
            name += `${typeSrc1}, ${typeSrc1.replace("challenges", "challenges_ops")}, \n                        `;
        } else {
            name += typeSrc1 + ", ";
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