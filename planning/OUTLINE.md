Introduction

- Cryptography
- Cryptographic primitives
  - Usage
  - Example
  - Importance of efficiency and correctness
  - How people currently write them
- Fiat crypto
  - Principle
  - Basic implementation overview
  - Usage
- Cryptopt % this could come in future work section
  - Principle, building on fiat crytpo
  - Basic implmenetation overivew
  - how it will connect to my thesis?
- AVX2
  - what are vectorized instrs
  - brief history and conventions
  - diffs and similarity to scalar instrs
  - usage

Related work (does this even apply?)
??

Goal

- Goal: extending fiat crypto to be compatible with avx instrs
  - which instrs?
    - useful for cryptography
    - widely used
    - settled on avx2
- what kind of programs?
  - SIMD
  - complex optimizations. e.g. neon crypto

System overview

- how does the original system work?
- how do avx instrs fit into this?
  - problems: hardcoded 64 bit operations
  - memory structure
  - registers
  - how operations compose
  - slicing, rewrite rules
    - hard problem of rewrite rule ordering and non-recursive expansion

Solutions/approach

- refactoring registers
- generalizing vector ops with helper functions
- decomposing into slicing and combining
- testing with simple programs and instructions
- more rewrite rules, recursive rewriting in special cases
- new memory read lemmas

Results

- instrs added
- show some basic programs we could check
- benchmark performance of these programs vs scalar implementations?
