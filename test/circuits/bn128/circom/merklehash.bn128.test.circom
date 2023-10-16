pragma circom 2.1.0;

include "../../../../circuits.bn128/merklehash.circom";

template parallel VerifyMH(eSize, elementsInLinear, nBits, arity) {
    var nLeaves = log2(arity);
    var nLevels = (nBits - 1)\nLeaves +1;
    signal input values[elementsInLinear][eSize];
    signal input siblings[nLevels][arity];
    signal input key[nBits];
    signal input root; 
    signal input enable;

    signal {binary} enabled <== enable;
    signal {binary} keyTags[nBits] <== key;

    VerifyMerkleHash(eSize, elementsInLinear, nBits, arity)(values, siblings, keyTags, root, enabled);
}

component main = VerifyMH(3, 9, 9, 16);