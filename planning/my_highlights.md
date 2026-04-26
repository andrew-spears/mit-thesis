# Register refactor

Existing code had only scalar registers, but scalar and vector regs are fundamentally different.

- hardcoded to 64 bits or less, with every reg aliasing into a 64 bit reg
  We put v/s reg directly in the type:

```
Inductive SREG := rax | rcx | ... | r15b.      (* all 64 scalar GPR aliases *)
Inductive VREG := xmm0 | ... | xmm15 | ymm0 | ... | ymm15.
Inductive REG  := SReg (r : SREG) | VReg (v : VREG).
```

So each module can reason about how to handle registers by the type.

# Working with reg values

Almost all refactoring on the symbolic side.
Old code handled 64 bit regs reads/writes as a special case.
64 bits shouldnt really be special - the reason is to avoid redundant slicing which might not simplify in the dag. so the special case should be full-register ops, when op size= widest reg size of aliasing regs.

```
Definition GetReg {opts : symbolic_options_computed_opt} {descr:description} r : M idx :=
  let '(rn, lo, sz) := index_and_shift_and_bitcount_of_reg r in
  v <- GetRegFull rn;
  App ((slice lo sz), [v]).

Definition SetReg {opts : symbolic_options_computed_opt} {descr:description} r (v : idx) : M unit :=
  let '(rn, lo, sz) := index_and_shift_and_bitcount_of_reg r in (* sz is the size of the register, not the value *)
  if (N.eqb lo 0) && (N.eqb sz (widest_reg_size_of r))
  then v <- App (slice 0 sz, [v]);
       SetRegFull rn v
  else old <- GetRegFull rn;
       v <- App ((set_slice lo sz), [old; v]);
       SetRegFull rn v.
```

With lemmas including

```
(* 1. Full-width register write *)
Lemma R_SetReg_full {opts : symbolic_options_computed_opt} {descr:description} s m (HR : R s m) r i _tt s'
  (Hoffset : reg_offset r = 0%N)
  (Hwidest : reg_size r = widest_reg_size_of r)
  (H : Symbolic.SetReg r i s = Success (_tt, s'))
  v (Hv : eval s i v)
  : exists m', Some (update_reg_with m (fun rs => set_reg rs r v)) = Some m'
    /\ R s' m' /\ s :< s'.

(* 2. Partial register write *)
Lemma R_SetReg_partial {opts : symbolic_options_computed_opt} {descr:description} s m (HR : R s m) r i _tt s'
  (Hpartial : ((reg_offset r =? 0)%N && (reg_size r =? widest_reg_size_of r)%N)%bool = false)
  (H : Symbolic.SetReg r i s = Success (_tt, s'))
  v (Hv : eval s i v)
  : exists m', Some (update_reg_with m (fun rs => set_reg rs r v)) = Some m'
  /\ R s' m' /\ s :< s'.
```

# Memory ops

- hardcoded 64 bit mem reads and writes.
- handled 64 bit regs writes as a special case

We need larger ops,
e.g. vmovdqu ymm0, [rbx] has to load 32 bytes, but GetOperand can only do 64 bits.
and no 64-bit special case (see above).

## Approach

Break Load op into a generic chunk loader, which loads chunks of 8 bytes in sequence.
This means the Dag has 4 Load64 nodes for a 256-bit load.

```
(* Load (n * 64) bits starting at addr, as a single idx.
Produces n sequential Load64s at addr, addr+8, ..., addr+8*(n-1),
combined via set_slice into one (n*64)-bit value. *)
Fixpoint Load_of_idx {opts : symbolic_options_computed_opt} {descr:description} {sa : AddressSize} (n : nat) (addr : idx) : M idx :=
match n with
| O      => App (const 0, nil)
| S n'   => prev   <- Load_of_idx n' addr;
            offset <- App (const (8 * Z.of_nat n'), nil);
            addr_k <- App (add sa, [addr; offset]);
            chunk  <- Load64 addr_k;
            App (set_slice (64 * N.of_nat n') 64, [prev; chunk])
end.

(* 128-bit load from an already-computed address idx: 2x Load64 + set_slice chain *)
Definition Load128_of_idx {opts : symbolic_options_computed_opt} {descr:description} {sa : AddressSize} (addr : idx) : M idx :=
Load_of_idx 2 addr.

(* 256-bit load from an already-computed address idx: 4x Load64 + set_slice chain *)
Definition Load256_of_idx {opts : symbolic_options_computed_opt} {descr:description} {sa : AddressSize} (addr : idx) : M idx :=
Load_of_idx 4 addr.


Definition Load {opts : symbolic_options_computed_opt} {descr:description} {s : OperationSize} {sa : AddressSize} (a : MEM) : M idx :=
let sz := Syntax.operand_size a s in
addr <- Address a;
if ((sz =? 8) || (sz =? 64))%N%bool then
    v <- Load64 addr;
    App ((slice 0 sz), [v])
else if (sz =? 128)%N then
    Load128_of_idx addr
else if (sz =? 256)%N then
    Load256_of_idx addr
else err (error.unsupported_memory_access_size sz).
```

Needed lemmas about composition of memory loading:

```
(* n1 n2 are in bytes *)
(* setting lower n1 bytes to lower part of v gives state m1 *)
(* setting upper n2 bytes to upper shifted part of v gives state m2 *)
(* then setting all bytes to v simultaneously gives m2. *)
Lemma SetMem_compose m addr n1 n2 v m1 m2 :
SetMem m addr n1 (Z.land v (Z.ones (8 * Z.of_nat n1))) = Some m1 ->
SetMem m1 (addr + Z.of_nat n1) n2 (Z.shiftr v (8 * Z.of_nat n1)) = Some m2 ->
SetMem m addr (n1 + n2) v = Some m2.
Proof.
```

# Symbolic execution

There are 2 principled ways to do this for vector ops. The pipeline between symbolic execution and semantics incurs a natural tradeoff, where one can push the computation details in one of two places.
If symbolic execution breaks an instr down into many simpler ops in the dag, then rewrite rules only need to normalize these existing ops (but must be powerful enough to see patterns).
On the other hand, symbolic execution could emit a single atomic op like 'vadd' in the dag. This means that interp_op needs to specify how this op decomposes in semantics, but also that rewrite rules need to handle this op in context.

## Option 1: details in symbolic execution

In the first regime, symbolic execution handles the details:

```
Module SymbolicVector.
(* === Vector instruction helpers === *)

(* Old lane-decomposition approach (kept for instructions without vector ops yet) *)
Definition make_lane {opts : symbolic_options_computed_opt} {descr : description}
  (v1 v2 : idx) (lane_op : op) (lane_idx : nat) (lane_width : Z) : M idx :=
  let offset := Z.of_nat lane_idx * lane_width in
  l1 <- App (slice (Z.to_N offset) (Z.to_N lane_width), [v1]);
  l2 <- App (slice (Z.to_N offset) (Z.to_N lane_width), [v2]);
  App (lane_op, [l1; l2]).

Fixpoint vector_binop_aux {opts : symbolic_options_computed_opt} {descr : description}
  (v1 v2 : idx) (lane_op : op) (lane_idx : nat) (num_remaining : nat)
  (lane_width : Z) (acc : idx) : M idx :=
  match num_remaining with
  | O => ret acc
  | S n =>
      lane_val <- make_lane v1 v2 lane_op lane_idx lane_width;
      new_acc <- App (set_slice (N.of_nat lane_idx * Z.to_N lane_width) (Z.to_N lane_width),
                      [acc; lane_val]);
      vector_binop_aux v1 v2 lane_op (S lane_idx) n lane_width new_acc
  end.

Definition vector_binop_idx {opts : symbolic_options_computed_opt} {descr : description}
  (v1 v2 : idx) (lane_op : op) (num_lanes : nat) (lane_width : Z) : M idx :=
  zero <- App (const 0, []);
  vector_binop_aux v1 v2 lane_op 0 num_lanes lane_width zero.

(* Old-style: decompose into per-lane scalar ops. Used for instructions
   that don't have a dedicated vector op yet. *)
Definition SymexVectorBinOp {opts : symbolic_options_computed_opt} {descr : description}
  {s : OperationSize} {sa : AddressSize}
  (dst src1 src2 : ARG) (lane_op : op) (lane_width : Z) : M unit :=
  let num_lanes := N.to_nat (s / Z.to_N lane_width)%N in
  v1 <- GetOperand src1;
  v2 <- GetOperand src2;
  result <- vector_binop_idx v1 v2 lane_op num_lanes lane_width;
  SetOperand dst result.

(* New-style: emit a vector op node in the DAG (as a hint for synthesis),
   then decompose the result into per-lane scalar ops for equivalence checking.
   Each lane is built via individual App calls so rewrite rules can simplify them.
   vector_op: constructs the vector op (e.g. vadd).
   scalar_op: the corresponding scalar op (e.g. add lane_width). *)
Definition SymexVectorOp {opts : symbolic_options_computed_opt} {descr : description}
  {s : OperationSize} {sa : AddressSize}
  (dst src1 src2 : ARG) (vector_op : N -> N -> op) (scalar_op : op)
  (lane_width_N : N) : M unit :=
  let num_lanes := N.to_nat (s / lane_width_N)%N in
  let lane_width := Z.of_N lane_width_N in
  v1 <- GetOperand src1;
  v2 <- GetOperand src2;
  (* Insert the vector op node as a synthesis hint (not used for output) *)
  _ <- App (vector_op lane_width_N (N.of_nat num_lanes), [v1; v2]);
  (* Build per-lane scalar results (each App call gets individually simplified) *)
  result <- vector_binop_idx v1 v2 scalar_op num_lanes lane_width;
  SetOperand dst result.
...

...
Definition SymexNormalInstruction {opts : symbolic_options_computed_opt} {descr:description} (instr : NormalInstruction) : M unit :=
  let stack_addr_size : AddressSize := 64%N in
  let sa : AddressSize := 64%N in
  match Syntax.operation_size instr with Some s =>
  match Syntax.prefix instr with None =>
  let s : OperationSize := s in
  let resize_reg r := some_or (fun _ => reg_of_index_and_shift_and_bitcount_opt (reg_index r, 0%N (* offset *), s)) (fun _ => error.unimplemented_instruction instr) in
  match instr.(Syntax.op), instr.(args) with
| vpaddq, [dst; src1; src2] => (* packed add of quadwords - no flags affected *)
      SymbolicVector.SymexVectorBinOp dst src1 src2 (add 64) 4 64
```

But this is slightly inelegant because now the dag doesnt reflect the use of vector ops, unless we reverse engineer them from pattern matching. This is important because (??synthesis might want to see it??)

## Option 2: atomic ops in symbolic execution

In the other regime, we actually define vector ops as native nodes in the dag:

```
Variant op := old s (_:symbol) | const (_ : Z) | add s | addcarry s | sub s | subborrow s | addoverflow s | neg s | shl s | shr s | sar s | rcr s | and s | or s | xor s | slice (lo sz : N) | mul s | set_slice (lo sz : N) | selectznz | iszero (* | ... *)
  | addZ | mulZ | negZ | shlZ | shrZ | andZ | orZ | xorZ | addcarryZ s | subborrowZ s
  (* Vector ops: lane-parallel operations on packed vectors.
     lane_width = bit width of each lane, num_lanes = number of lanes.
     Each takes 2 args (full vector operands) and produces a full vector result. *)
  | vadd (lane_width num_lanes : N)
  | vsub (lane_width num_lanes : N).
```

Then symbolic execution is very simple:

```
Definition SymexNormalInstruction {opts : symbolic_options_computed_opt} {descr:description} (instr : NormalInstruction) : M unit :=
...
  | vpaddq, [dst; src1; src2] => (* packed add of quadwords *)
    let num_lanes := (s / 64)%N in
    v1 <- GetOperand src1;
    v2 <- GetOperand src2;
    result <- App ((vadd 64 num_lanes), [v1; v2]);
```

But we now need to handle vadd op in `interp_op`. Defining the behaviour of vector ops is very modular because most AVX instrs operate on lane values independently in a similar pattern.

Allows for a simple function like

```
(* Lane-parallel vector interpretation: applies a scalar binary operation
     independently to each lane of two packed vectors, combining results. *)
Fixpoint interp_vector_binop (scalar_op : Z -> Z -> Z) (lane_width : Z)
(lane_idx num_remaining : nat) (a b : Z) : Z :=
match num_remaining with
| O => 0
| S n =>
    let offset := Z.of_nat lane_idx * lane_width in
    let keep x := Z.land x (Z.ones lane_width) in
    let la := keep (Z.shiftr a offset) in
    let lb := keep (Z.shiftr b offset) in
    let result := keep (scalar_op la lb) in
    Z.lor (Z.shiftl result offset)
            (interp_vector_binop scalar_op lane_width (S lane_idx) n a b)
end%Z.
```

to define most avx instrs, with some exceptions.
e.g. vadd

```
(* defines what each op actually does in symbolic computation *)
Definition interp_op o (args : list Z) : option Z :=
    Eval cbv [invert_Some identity op_to_Z_binop] in
    let keep n x := Z.land x (Z.ones (Z.of_N n)) in
    match o, args with
    | vadd lw nl, [a; b] => Some (interp_vector_binop Z.add (Z.of_N lw) 0 (N.to_nat nl) a b)
```

Then we get nice rewriting properties from lemmas like:

```
(* Extracting lane k from a vector binop equals applying the scalar op to
   the extracted lanes. Requires lo to be lane-aligned and in range. *)
Lemma interp_vector_binop_slice_lane scalar_op lane_width lo sz a b num_lanes :
  lane_width > 0 ->
  sz = Z.to_N lane_width ->
  (Z.of_N lo) mod lane_width = 0 ->
  (lo + sz <= sz * num_lanes)%N ->
  Z.land (scalar_op
              (Z.land (Z.shiftr a (Z.of_N lo)) (Z.ones (Z.of_N sz)))
              (Z.land (Z.shiftr b (Z.of_N lo)) (Z.ones (Z.of_N sz))))
           (Z.ones (Z.of_N sz))
  = Z.land (Z.shiftr (interp_vector_binop scalar_op lane_width 0 (N.to_nat num_lanes) a b) (Z.of_N lo))
         (Z.ones (Z.of_N sz)).
```

For example:

```
(* Decompose a slice of a vector add into a scalar add of slices.
   slice lo lw (vadd lw nl [v1; v2]) → add lw [slice lo lw v1; slice lo lw v2]
   when lo is lane-aligned (lo mod lw = 0) and in range (lo + lw <= lw * nl).
   Uses coalescing_slice to collapse any nested slice(slice(...)) in the args,
   since merge doesn't run rewrite passes on subexpressions. *)
Definition slice_vadd (d : dag) :=
  fun e => match e with
    ExprApp (slice lo lw, [ExprApp (vadd lw' nl, [v1; v2])]) =>
      if N.eqb lw lw' && N.eqb (lo mod lw)%N 0%N && N.leb (lo + lw) (lw' * nl) && N.ltb 0 lw
      then ExprApp (add lw, [coalescing_slice lo lw v1; coalescing_slice lo lw v2])
      else e | _ => e end%bool%N.
```

Notice this requires a new helper rewrite function:

```
(* Helper: build slice lo lw [v], coalescing nested slices.
   If v = slice lo2 s2 [e'] and lo+lw <= s2, produce slice (lo2+lo) lw [e'] instead. *)
Definition coalescing_slice (lo lw : N) (v : expr) : expr :=
  match v with
  | ExprApp (slice lo2 s2, [e']) =>
      if N.leb (lo + lw) s2 then ExprApp (slice (lo2 + lo) lw, [e'])
      else ExprApp (slice lo lw, [v])
  | _ => ExprApp (slice lo lw, [v])
  end%N.
```

since we get a lot of nested slices coming out of the slice_vadd rule otherwise, and the other rewrite rules aren't sophisticated enough to recurse into this.

In fact, we ended up adding this rule as well:

```
(* Recursively normalize (slice lo sz) over nested slice/set_slice towers,
   peeling three kinds of layers at once:
   - nested slice lo2 s2: combine offsets to (lo2+lo, sz, e')
   - disjoint set_slice lo2 s2: descend into base
   - containing set_slice lo2 s2: descend into val with adjusted lo
   Needed for gather patterns (vmovq -> vpunpcklqdq -> vinserti128) that
   interleave slice and set_slice layers, which the individual rules miss. *)
Fixpoint slice_tower_normalize (lo sz : N) (inner : expr) (fuel : nat) {struct fuel} : expr :=
  match fuel with
  | O => ExprApp (slice lo sz, [inner])
  | S fuel' =>
    match inner with
    | ExprApp (slice lo2 s2, [e']) =>
        if N.leb (lo + sz) s2
        then slice_tower_normalize (lo2 + lo) sz e' fuel'
        else ExprApp (slice lo sz, [inner])
    | ExprApp (set_slice lo2 s2, [base; val]) =>
        if (N.leb (lo + sz) lo2 || N.leb (lo2 + s2) lo)%bool
        then slice_tower_normalize lo sz base fuel'
        else if (N.leb lo2 lo && N.leb (lo + sz) (lo2 + s2))%bool
        then slice_tower_normalize (lo - lo2) sz val fuel'
        else ExprApp (slice lo sz, [inner])
    | _ => ExprApp (slice lo sz, [inner])
    end
  end%N.

Definition slice_tower (d : dag) :=
  fun e => match e with
    ExprApp (slice lo sz, [inner]) =>
      slice_tower_normalize lo sz inner 16
  | _ => e end.
```

to handle similar patterns in the dag. Its unclear whether both are truly necessary, but one could check empirically.
