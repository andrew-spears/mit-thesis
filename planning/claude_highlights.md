# Vectorized Extensions to Fiat-Crypto — Technical Summary

Branch: `vectorized` (23 commits since `master`). Scope: `src/Assembly/` +
`src/Assembly/WithBedrock/` + `src/PushButtonSynthesis/SIMDUnsaturatedSolinas.v`

- `test-asm/`. Adds AVX/AVX2 register modeling, packed-vector concrete and
  symbolic semantics, DAG rewrite rules for lane simplification, 128/256-bit
  memory ops, and a batched synthesis frontend. Current driving test:
  `vpaddq` on curve25519 `fiat_25519_add`, passing in XMM, YMM, and batched
  (4×) configurations.

---

## 1. Register Model: a unified `REG` type

**Before:** fiat-crypto's assembly IR had a single flat `REG` inductive
enumerating the 16 GPRs at each of their four widths (8/16/32/64 bit). All
register-indexed state was a 16-entry tuple, and every operation assumed a
64-bit value shape.

**Now** (`src/Assembly/Syntax.v`):

```coq
Inductive SREG := rax | rcx | ... | r15b.      (* all 64 scalar GPR aliases *)
Inductive VREG := xmm0 | ... | xmm15 | ymm0 | ... | ymm15.
Inductive REG  := SReg (r : SREG) | VReg (v : VREG).
```

A `reg_size : REG -> N` returns `8/16/32/64` for SREGs and `128/256` for
VREGs. `widest_register_of` collapses an alias to its widest form:
`al → rax`, `xmm5 → ymm5`. The symbolic machine state `reg_state` is now
sized by `List.length widest_registers = 32` (16 GPR slots + 16 YMM slots)
instead of the previous hardcoded 16. All downstream code computes
`widest_reg_size_of r` instead of assuming 64.

Memory operands (`MEM` record) are restricted to `SREG` for base and
scale — you never address memory through a vector register, and this
restriction avoids proof obligations about vector-width arithmetic on
addresses. This required minor edits in `src/Assembly/Equality.v` and the
default calling-convention list in `src/Assembly/Equivalence.v`
(`default_assembly_calling_registers := List.map SReg [rdi;...]`).

The auto-derived `OpCode_Listable` / `Reg_Listable` machinery handles
parsing: adding a vector register or opcode to the inductive is sufficient
for the string parser to recognize it.

---

## 2. Concrete Semantics: `SemanticVector`

`src/Assembly/WithBedrock/Semantics.v` adds a `Module SemanticVector`
defining lane-parallel operations on a flat `Z` (the model stores each
vector register as a single `Z` that is interpreted as packed lanes):

```coq
Definition extract_lane (v : Z) (lane_idx : nat) (lane_width : Z) : Z :=
  Z.land (Z.shiftr v (Z.of_nat lane_idx * lane_width)) (Z.ones lane_width).

Definition insert_lane (lane_val : Z) (lane_idx : nat) (lane_width : Z) : Z :=
  Z.shiftl (Z.land lane_val (Z.ones lane_width)) (Z.of_nat lane_idx * lane_width).

Fixpoint vector_binop_aux (v1 v2 : Z) (lane_op : Z -> Z -> Z)
    (lane_idx num_remaining : nat) (lane_width : Z) : Z :=
  match num_remaining with
  | O   => 0
  | S n => Z.lor (insert_lane (lane_op (extract_lane v1 lane_idx lane_width)
                                        (extract_lane v2 lane_idx lane_width))
                              lane_idx lane_width)
                 (vector_binop_aux v1 v2 lane_op (S lane_idx) n lane_width)
  end.
```

`DenoteVectorBinOp` wraps this with `GetOperand`/`SetOperand`. `broadcast`
and `blend` follow the same shape. 15 AVX/AVX2 opcodes have concrete
semantics: `vmovq`, `vmovdqu`, `vpaddq`, `vpsubq`, `vpandq`, `vporq`,
`vpxorq`, `vpaddd`, `vpsubd`, `vpmuludq`, `vpsllq`, `vpsrlq`,
`vpbroadcastq`, `vpblendd`, `vpunpcklqdq`, `vpunpckhqdq`, `vpextrq`,
`vextracti128`, `vinserti128`, `vzeroupper`. Lane count is derived from
the register's bit-width (`s / lane_width`) so one case handles both XMM
(2×64) and YMM (4×64) under `vpaddq`.

---

## 3. Symbolic Semantics: DAG vector ops + lane decomposition

The symbolic layer takes a two-level approach. The DAG gains two new
operations (`src/Assembly/Symbolic.v`):

```coq
Variant op := ... | vadd (lane_width num_lanes : N) | vsub (lane_width num_lanes : N).
```

with interpretation:

```coq
Fixpoint interp_vector_binop (scalar_op : Z -> Z -> Z) (lane_width : Z)
  (lane_idx num_remaining : nat) (a b : Z) : Z := ...
| vadd lw nl, [a; b] => Some (interp_vector_binop Z.add (Z.of_N lw) 0 (N.to_nat nl) a b)
```

On top of `vadd`/`vsub`, `SymexNormalInstruction` for `vpaddq` emits
**both** a top-level `vadd` node **and** a per-lane `set_slice`/`add`
decomposition:

```coq
| vpaddq, [dst; src1; src2] =>
    let num_lanes := (s / 64)%N in
    v1 <- GetOperand src1;
    v2 <- GetOperand src2;
    result <- App ((vadd 64 num_lanes), [v1; v2]);
    SetOperand dst result
```

(The decomposed form lives in `SymbolicVector.vector_binop_idx` and is
used via `SymexVectorOp` for instructions where the vector-level DAG op
doesn't help the checker.)

**Why two representations?** The PHOAS side of the equivalence checker
emits scalar `add 64` nodes inside a bigger expression tree. The
assembly side observes a packed-vector result and, when the program later
stores individual lanes back to memory, slices 64-bit windows out of that
packed value. Without the `vadd` node, the checker sees a deeply nested
`set_slice` tower that doesn't reduce to `add 64` via the existing rewrite
rules. The `vadd` op + a `slice_vadd` rewrite rule (§5) lets the checker
recover the scalar `add 64` directly.

---

## 4. Generalized Memory: 128/256-bit `Load`, `Store`, `Remove`

The original `Load`/`Store` only handled 8- or 64-bit accesses, yielding a
single `Load64` followed by `slice 0 sz`. Vector loads require contiguous
multi-qword access, so we generalized:

```coq
Fixpoint Load_of_idx (n : nat) (addr : idx) : M idx :=
  match n with
  | O    => App (const 0, nil)
  | S n' => prev   <- Load_of_idx n' addr;
            offset <- App (const (8 * Z.of_nat n'), nil);
            addr_k <- App (add sa, [addr; offset]);
            chunk  <- Load64 addr_k;
            App (set_slice (64 * N.of_nat n') 64, [prev; chunk])
  end.

Definition Load {s : OperationSize} (a : MEM) : M idx :=
  let sz := operand_size a s in
  addr <- Address a;
  if (sz =? 8) || (sz =? 64) then v <- Load64 addr; App (slice 0 sz, [v])
  else if sz =? 128 then Load_of_idx 2 addr
  else if sz =? 256 then Load_of_idx 4 addr
  else err ....
```

`Store` and `Remove` are expanded symmetrically: a 256-bit store becomes
4× `slice 64k 64` followed by 4× `Store64` at `addr, addr+8, addr+16,
addr+24`. This keeps the mem model single-width-homogeneous (the symbolic
memory is a list of `(addr_idx, val_idx)` pairs where each cell is 64 bits)
while letting wider operations decompose transparently.

A parallel change affects register access. The old `SetReg` special-cased
`sz == 64` vs. "everything else is a sub-register write":

```coq
(* before *)
if N.eqb sz 64 then ... else (* partial-width path with read-modify-write *)
```

Now it uses the widest-register width:

```coq
(* after *)
if (N.eqb lo 0) && (N.eqb sz (widest_reg_size_of r))
then v <- App (slice 0 sz, [v]); SetRegFull rn v
else old <- GetRegFull rn; v <- App (set_slice lo sz, [old; v]); SetRegFull rn v
```

Writes to YMM go through the full-width path; writes to XMM go through the
partial path (with a `set_slice 0 128` update of the underlying YMM slot),
matching AVX semantics.

---

## 5. DAG Rewrite Rules

The checker compares two DAGs by literal node-index equality after applying
a fixed sequence of rewrite passes. Several new rules were needed so the
assembly-side DAG — full of packed-lane `slice`/`set_slice` chains —
normalizes to the same form as the PHOAS-side scalar DAG.

**`slice_slice`** — collapse nested slices:

```coq
slice lo1 s1 [slice lo2 s2 [e']]  →  slice (lo2+lo1) s1 [e']    when lo1+s1 ≤ s2
```

**`slice_set_slice`** (now ranged, not just `lo=0`):

```coq
slice lo1 s1 [set_slice lo2 s2 [_; e']] → slice (lo1-lo2) s1 [e']
    when lo2 ≤ lo1 ∧ lo1+s1 ≤ lo2+s2      (* slice fully inside set's range *)
```

**`slice_set_slice_disjoint`**, built on a fuel-recursive helper
`peel_disjoint_set_slices` (fuel = 8). Needed because a YMM 4-lane
operation emits 3 stacked `set_slice` layers; one pass of the previous
rule only peels one:

```coq
slice lo1 s1 [set_slice lo2 s2 [base; _]] → peel_disjoint_set_slices lo1 s1 base 8
    when lo1+s1 ≤ lo2  ∨  lo2+s2 ≤ lo1
```

**`slice_tower`** (the big one — NOTES.md §2026-04-11). Rewrite passes are
applied once, top-down, with no re-entry. The gather patterns needed for
`vmovq → vpunpcklqdq → vinserti128` produce trees like
`slice(set_slice(slice(set_slice(slice(...)))))` where each of the three
rules above handles one layer. A single traversal can't alternate between
them, so we replace them with one fuel-recursive normalizer that handles
all three cases in a single rule invocation:

```coq
Fixpoint slice_tower_normalize (lo sz : N) (inner : expr) (fuel : nat) : expr :=
  match fuel with
  | O    => ExprApp (slice lo sz, [inner])
  | S f' =>
    match inner with
    | ExprApp (slice lo2 s2, [e']) =>
        if lo + sz ≤ s2 then slice_tower_normalize (lo2 + lo) sz e' f' else ...
    | ExprApp (set_slice lo2 s2, [base; val]) =>
        if disjoint  then slice_tower_normalize lo      sz base f'
        if contained then slice_tower_normalize (lo-lo2) sz val  f'
        else ...
    | _ => ExprApp (slice lo sz, [inner])
    end
  end.
```

**`slice_vadd` / `slice_vsub`** — the bridge between the vector DAG op and
scalar reasoning. These fire when a byte-aligned slice of a `vadd`/`vsub`
node has the same width as one lane, turning it into a scalar `add`/`add+neg`:

```coq
slice lo lw [vadd lw' nl [v1; v2]]  →  add lw [coalescing_slice lo lw v1;
                                                coalescing_slice lo lw v2]
    when lw = lw' ∧ lo mod lw = 0 ∧ lo+lw ≤ lw'*nl ∧ lw > 0
```

`coalescing_slice` is necessary because `merge` — the DAG deduplication
function — doesn't re-run rewrite passes on subexpressions it embeds, so
nested slices have to be collapsed by the rule itself, not relied on from
a later pass.

**`sub_to_add_neg`** — normalizes `sub s [a; b]` to `add s [a; neg s [b]]`
so the PHOAS form (which canonicalizes subtraction through `Z_opp`) and
the assembly form agree.

All six rules have OK-proofs (semantic preservation). Most reduce to
`t. f_equal. Z.bitblast.`; `slice_tower_ok` requires manual induction on
fuel, and `slice_vadd_ok` relies on a sequence of lemmas about
`interp_vector_binop`:

```coq
Lemma interp_vector_binop_extract scalar_op lw lane_idx nr k a b :
  (0 < lw)%Z -> (lane_idx <= k)%nat -> (k < lane_idx + nr)%nat ->
  Z.land (Z.shiftr (interp_vector_binop scalar_op lw lane_idx nr a b)
                   (Z.of_nat k * lw)) (Z.ones lw)
  = Z.land (scalar_op (Z.land (Z.shiftr a (Z.of_nat k * lw)) (Z.ones lw))
                       (Z.land (Z.shiftr b (Z.of_nat k * lw)) (Z.ones lw)))
           (Z.ones lw).
```

i.e. "extracting lane `k` from a vector binop equals the scalar op on
extracted lanes" — the core correctness statement for the `slice (vadd)`
decomposition.

---

## 6. Proof Extensions (`SymbolicProofs.v`)

The machine-state relation `R (ss : symbolic_state) (ms : machine_state)`
ties the symbolic DAG to the bedrock2 concrete semantics. The branch
widens `R_reg` to carry a per-register width:

```coq
Definition R_reg (x : option idx) (v : Z) (width : N) : Prop :=
  (forall i, x = Some i -> eval i v) /\ (v = Z.land v (Z.ones (Z.of_N width))).

Definition R_regs (sr : Symbolic.reg_state) (mr : Semantics.reg_state) : Prop :=
  let widths := List.map (fun r => reg_size r) widest_registers in
  Forall2 (fun w '(x, v) => R_reg x v w)
          widths
          (List.combine (Tuple.to_list _ sr) (Tuple.to_list _ mr)).
```

The width lives per-register because YMM slots carry 256 bits of payload
and GPR slots carry 64. Before, the invariant was uniform at 64 bits.

**`LoadN_R`** — the new `Load_of_idx n` metatheorem:

```coq
Lemma LoadN_R (Hsa : sa = 64%N)
  n s m (HR : R s m) (addr : idx) va (Ha : eval s addr va)
  i s' (H : Load_of_idx n addr s = Success (i, s'))
  : R s' m /\ s :< s' /\
    exists v, eval s' i v /\ get_mem m va (8 * n) = Some v /\
              v = Z.land v (Z.ones (64 * Z.of_nat n)).
```

Proved by induction on `n`. The step case reads `prev` via IH, issues a
fresh `Load64` at `addr + 8n'`, and combines the two via `set_slice`.
Requires two mechanical lemmas:
`load_bytes_app_split` (concatenation of byte loads) and `get_mem_app_split`
(the high-level analog). `Load128_R` and `Load256_R` are immediate
corollaries. `GetOperand_R` (~line 1016) dispatches on `sz ∈ {8, 64, 128,
256}` and calls the corresponding `LoadN_R` instantiation.

**`R_SetReg_full` / `R_SetReg_partial`**: the old `SetReg` had one proof
case. Now two: full-width writes (new path, used for YMM and any
register whose width is its widest) and partial-width writes (XMM-into-YMM,
the historical sub-register case). The full-width lemma uses the fact that
a same-width write zeros nothing (the old `Z.ldiff` mask term collapses
because the bits-out-of-range property of the old value matches the mask
exactly):

```coq
assert (Hldiff : Z.ldiff conc_old (Z.ones (Z.of_N (widest_reg_size_of r))) = 0).
```

`R_SetReg_partial` is not yet complete (see §9).

**Vector binop bridge lemma** connects the DAG interpreter to the concrete
interpreter:

```coq
Lemma interp_vector_binop_eq_vector_binop_values
      (scalar_op : Z -> Z -> Z) (lw : Z) (nr : nat) (v1 v2 : Z) :
  lw > 0 ->
  interp_vector_binop scalar_op lw 0 nr v1 v2
  = SemanticVector.vector_binop_values v1 v2
      (fun a b => Z.land (scalar_op a b) (Z.ones lw)) nr lw.
```

---

## 7. Synthesis-side Batching

`src/PushButtonSynthesis/SIMDUnsaturatedSolinas.v` defines batched versions
of the existing primitives by concatenating four independent copies of the
scalar spec:

```coq
Definition batched_addmod (a b : list Z) : list Z :=
  addmod L n (firstn n a)              (firstn n b) ++
  addmod L n (firstn n (skipn n a))    (firstn n (skipn n b)) ++
  addmod L n (firstn n (skipn (n+n) a))   (firstn n (skipn (n+n) b)) ++
  addmod L n (firstn n (skipn (n+n+n) a)) (firstn n (skipn (n+n+n) b)).
```

and similarly for `batched_submod`, `batched_carrymod`,
`batched_carry_mulmod`. Each is run through `Derive` +
`cache_reify ()` + `BoundsPipeline` exactly like the scalar version,
yielding PHOAS expressions the equivalence checker can target. Registered
as new CLI operations via `sbatch_add`, `sbatch_sub`, `sbatch_carry`,
`sbatch_carry_mul` in `UnsaturatedSolinas.v`. The layout is
**array-of-structures** (4 complete n-limb field elements concatenated),
so each YMM register loaded from consecutive memory holds one limb
position of 4 distinct elements.

An earlier experimental `src/SIMDBatch.v` attempts a generic PHOAS-level
lift (`batch_type : type → type`, `BatchExpr : Expr t → Expr (batch_type t)`)
but has been archived pending pipeline integration.

---

## 8. Worked Example: `vpaddq` on curve25519 `add`

Scalar reference (`fiat_25519_add`, 5 × 64-bit limbs):

```asm
mov rax, [rsi]      ; limb 0
add rax, [rdx]
mov [rdi], rax
... (4 more)
ret
```

XMM version (`test-asm/simple_avx_add.asm`, 2 lanes):

```asm
vmovdqu xmm0, [rsi]
vmovdqu xmm1, [rdx]
vpaddq  xmm0, xmm0, xmm1
vmovdqu [rdi], xmm0
vmovdqu xmm0, [rsi + 16]
vmovdqu xmm1, [rdx + 16]
vpaddq  xmm0, xmm0, xmm1
vmovdqu [rdi + 16], xmm0
vmovq   xmm0, [rsi + 32]
vmovq   xmm1, [rdx + 32]
vpaddq  xmm0, xmm0, xmm1
vmovq   [rdi + 32], xmm0
ret
```

YMM version does 4 limbs in one `vpaddq ymm`, scalar adds the 5th.

Batched version (spec: `unsaturated_solinas 25519 64 20 '2^255 - 19' add`,
where 20 = 5 limbs × 4 elements): 5 YMM adds over 20 consecutive uint64s,
one `vzeroupper`, one `ret`. PHOAS produces 20 scalar `add 64` nodes; the
AVX symex produces 5 `vadd 64 4` nodes. After the rewrite pipeline, each
`store slice (vadd ...)` reduces to a scalar `add 64` via `slice_vadd`,
making PHOAS and AVX DAGs structurally identical and the equivalence check
passes by `N.eqb` on output indices.

The trajectory: `vpaddq` drove (a) the register split, (b) the `SemanticVector`
module, (c) 128/256-bit memory ops, (d) the `vadd` DAG op and
`slice_vadd` rule, (e) the `R_reg` per-width invariant. Every later
instruction (`vpsubq`, `vpmuludq`, `vpsrlq`, `vpandq`, …) reuses this
scaffolding.

---

## 9. Key Design Decisions & Issues

**Why a unified `REG` instead of a parallel scalar/vector machine state?**
Fewer invariants: one tuple, one `index_and_shift_and_bitcount_of_reg`
function, one `R_regs` relation. The cost is that every piece of code that
previously assumed 64-bit registers had to be parameterized by
`widest_reg_size_of r`.

**Why emit both `vadd` and a per-lane decomposition?** The `vadd` node is
a _synthesis hint_: the checker's comparison is on indices post-rewrite,
and PHOAS never produces `vadd`, so the node only helps if a later rewrite
rule consumes it. `slice_vadd` is that consumer. The decomposition
exists so that, if the AVX program stores the whole vector back to memory
(rather than lane-by-lane), the assembly DAG doesn't contain
unreduced `vadd` nodes that PHOAS can't match.

**Why not just increase `default_node_reveal_depth`?** Tried (3→6→10). It
expands the initial tree but doesn't address the rewrite-pass re-application
problem. Fuel-recursive rules (`peel_disjoint_set_slices`, `slice_tower_normalize`)
are the right structural fix.

**Why AoS and not SoA for batched specs?** AoS keeps the spec
isomorphic to 4 independent scalar calls — `batched_addmod = add ++ add ++
add ++ add` — which the bounds pipeline accepts without modification. SoA
would require reshaping the spec and interleaving limbs at the PHOAS level,
which we haven't done. Real AVX2 curve25519 implementations (avxecc,
curve25519-dalek-ng) use SoA with reduced radix (9×29-bit or 10×25.5-bit)
because `vpmuludq` only does 32×32→64. Matching those would require a
spec reshape or a 9-limb radix.

**Rewrite rule ordering.** `default_rewrite_pass_order` is traversed
left-to-right, so if rule A produces patterns that rule B simplifies
further, A must come before B. The SIMD rules were added between
`set_slice_set_slice` and `set_slice0_small`, with careful interleaving:
`slice_slice ; slice_vadd ; slice_vsub ; slice_tower ; slice_set_slice_disjoint
; slice_set_slice ; slice_set_slice_disjoint ; slice_set_slice ;
slice_set_slice_disjoint ; slice_set_slice`. The duplicates are
intentional alternation for gather-tower patterns, though `slice_tower`
now mostly obsoletes them.

**Open issue: `R_SetReg_partial`.** The partial write lemma at line 1179
of `SymbolicProofs.v` is in progress. Needed for XMM→YMM alias safety in
the end-to-end SymexLines_R proof. `R_SetReg_full` is done.

---

## 10. Test Infrastructure

`test-asm/test-manifest.tsv` lists 10 equivalence-check tests, all
passing:

| test                 | shape               | opcodes exercised                        |
| -------------------- | ------------------- | ---------------------------------------- |
| `avx-xmm-add`        | XMM, 2 lanes        | vmovdqu, vmovq, vpaddq                   |
| `avx-ymm-add`        | YMM, 4 lanes        | vmovdqu, vpaddq, vzeroupper              |
| `avx-xmm-sub`        | XMM                 | vpsubq + 0xfda balance constants         |
| `avx-ymm-sub`        | YMM                 | "                                        |
| `batch-avx-add`      | YMM, 20-limb AoS    | vmovdqu, vpaddq                          |
| `batch-avx-sub`      | YMM, 20-limb AoS    | vpsubq + per-lane constants via vpblendd |
| `scalar-carry-mul`   | scalar reference    | (sanity baseline)                        |
| `batch-carry-mul`    | 4× scalar carry_mul | (sanity baseline)                        |
| `batch-scalar-carry` | 4× scalar carry     | (sanity baseline)                        |
| `batch-avx-carry`    | 4× YMM carry        | vpaddq, vpsrlq, vpandq                   |

Runner: `./test-asm/run-tests.sh` tracks `expected ∈ {pass, fail, skip}`
and reports `XPASS` when a test unexpectedly passes — useful for flipping
status when a new rewrite rule fixes a previously failing program.

---

## 11. Summary of Code Additions

| File                                                  | Δ lines | purpose                                                                                                        |
| ----------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `src/Assembly/Syntax.v`                               | +225    | VREG, unified REG, 20 AVX opcodes                                                                              |
| `src/Assembly/WithBedrock/Semantics.v`                | +236    | `SemanticVector`, 15 opcode denotations                                                                        |
| `src/Assembly/Symbolic.v`                             | +895    | `vadd`/`vsub`, 6 rewrite rules, 128/256-bit Load/Store/Remove, `SymbolicVector` helpers, 20 opcode symex cases |
| `src/Assembly/WithBedrock/SymbolicProofs.v`           | +838    | width-indexed `R_reg`, `LoadN_R`, `R_SetReg_{full,partial}`, `interp_vector_binop` lemmas                      |
| `src/Assembly/Parse.v`, `Equality.v`, `Equivalence.v` | +160    | MEM restricted to SREG, calling-convention coercion                                                            |
| `src/PushButtonSynthesis/SIMDUnsaturatedSolinas.v`    | new     | batched reified specs                                                                                          |
| `src/PushButtonSynthesis/UnsaturatedSolinas.v`        | +60     | `batch_add`, `batch_sub`, `batch_carry`, `batch_carry_mul` CLI entry points                                    |
| `test-asm/`                                           | new     | 10 AVX test programs + manifest + runner                                                                       |

Total: roughly **+2500 lines of verified or partially-verified Coq**,
+~600 lines of test assembly.
