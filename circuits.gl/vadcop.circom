pragma circom 2.1.0;

include "mux1.circom";
include "mux2.circom";

// Given a circuit type, return the corresponding verification key
template SelectVerificationKey(nRecursives1) {

    // 0 -> Null
    // 1 -> Recursive2
    // 2 -> Basic1 (Recursive1)
    // 3 -> Basic2 (Recursive1)
    // ...
    signal input circuitType;

    // Recursive2 verification key. It needs to be provided as input because it is not known at compile time
    signal input rootCRecursive2[4];
    
    // Recursive1 verification keys;
    signal input rootCRecursives1[nRecursives1][4];

    // Verification key corresponding to the circuit type
    signal output verificationKey[4];

    // The idea is to store an array of booleans which will indicate either 0 or 1 depending if the circuit type is equal to the index
    // For instance, [0,1,0,0] would mean that the circuit type is a recursive2.
    // Then, we will calculate the verification key as the sum of all the verification keys multiplied by the corresponding boolean
    signal isType[nRecursives1 + 2];
    var isValidType = 0;
    for(var i = 0; i < nRecursives1 + 2; i++) {
        isType[i] <== IsZero()(i - circuitType);
        isValidType += isType[i];
    }

    // Check that the type is supported
    isValidType === 1;

    signal verificationKeys[nRecursives1 + 2][4];
    verificationKeys[0] <== [0,0,0,0];
    verificationKeys[1] <== rootCRecursive2;
    for(var i = 0; i < nRecursives1; i++) {
        verificationKeys[i + 2] <== rootCRecursives1[i];
    }

    signal accVK[nRecursives1 + 2][4];

    for(var i = 0; i < nRecursives1 + 2; i++) {
        if(i == 0) {
            for(var j = 0; j < 4; j++) {
                accVK[i][j] <== isType[i]*verificationKeys[i][j];
            }
        } else {
            for(var j = 0; j < 4; j++) {
                accVK[i][j] <== isType[i]*verificationKeys[i][j] + accVK[i - 1][j];
            }
        }
    }

    verificationKey <== accVK[nRecursives1 + 1];
}

template AggregateValues() {
    signal input valueA[4];
    signal input valueB[4];
    signal input {binary} isNullA; // 1 if is circuit type A is 0 (null), 0 otherwise
    signal input {binary} isNullB; // 1 if is circuit type B is 0 (null), 0 otherwise

    signal output valueAB[4];

    // Calculate the hash of valueA and valueB
    signal hash[12] <== Poseidon(12)([valueA[0], valueA[1], valueA[2], valueA[3], valueB[0], valueB[1], valueB[2], valueB[3]], [0,0,0,0]);
    signal hashAB[4] <== [hash[0], hash[1], hash[2], hash[3]];

    // If valueA or valueB is [0,0,0], it means that the particular subproof does not have that stage. Therefore we should proceed the same way as if circuitType is null
    signal isValueA1Zero <== IsZero()(valueA[0]);
    signal isValueA2Zero <== IsZero()(valueA[1]);
    signal isValueA3Zero <== IsZero()(valueA[2]);
    signal isValueA4Zero <== IsZero()(valueA[3]);
    signal isValueAZero <== IsZero()(4 - (isValueA1Zero + isValueA2Zero + isValueA3Zero + isValueA4Zero));

    signal isValueB1Zero <== IsZero()(valueB[0]);
    signal isValueB2Zero <== IsZero()(valueB[1]);
    signal isValueB3Zero <== IsZero()(valueB[2]);
    signal isValueB4Zero <== IsZero()(valueB[3]);
    signal isValueBZero <== IsZero()(4 - (isValueB1Zero + isValueB2Zero + isValueB3Zero + isValueB4Zero));


    // If circuit type A is null || valueA === 0 and circuit type B is null || valueB === 0, then the valueAB is 0
    // If circuit type A is not null && valueA !== 0 and circuit type B is null || valueB === 0, then the valueAB is valueA
    // If circuit type A is null || valueA === 0 and circuit type B is not null && valueB !== 0, then the valueAB is valueB
    // If circuit type A is not null && valueA !== 0 and circuit type B is not null && valueB !== 0, then the valueAB is hashAB

    signal {binary} s[2] <== [(1 - isNullA)*(1 - isValueAZero), (1 - isNullB)*(1 - isValueBZero)];
    valueAB <== MultiMux2(4)([[0,0,0,0], valueA, valueB, hashAB], s);

}

template AggregateSubAirValues() {
    signal input subAirValueA[3];
    signal input subAirValueB[3];
    signal input {binary} isNullA; // 1 if is circuit type A is 0 (null), 0 otherwise 
    signal input {binary} isNullB; // 1 if is circuit type B is 0 (null), 0 otherwise 

    signal input {binary} aggregationType; // 1 if aggregation is multiplication, 0 if aggregation is addition

    signal output subAirValueAB[3];

    // If circuit type A is null, then its subAirValue is zero;
    signal valueA[3] <== [ (1 - isNullA)*subAirValueA[0], (1 - isNullA)*subAirValueA[1], (1 - isNullA)*subAirValueA[2] ];

    // If circuit type B is null, then its subAirValue is zero;
    signal valueB[3] <== [ (1 - isNullB)*subAirValueB[0], (1 - isNullB)*subAirValueB[1], (1 - isNullB)*subAirValueB[2] ];

    signal values[2][3];
    values[0] <== [valueA[0] + valueB[0], valueA[1] + valueB[1], valueA[2] + valueB[2]];
    values[1] <== [valueA[0] * valueB[0], valueA[1] * valueB[1], valueA[2] * valueB[2]];

    // Either add or multiply the subAirValues according to the aggregation type and then return the result
    subAirValueAB <== MultiMux1(3)(values, aggregationType);
}