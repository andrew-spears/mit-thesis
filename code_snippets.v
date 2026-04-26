Fixpoint vector_binop_aux {opts : symbolic_options_computed_opt} {descr : description}
    (v1 v2 : idx) (lane_op : op) (lane_idx : nat) (num_remaining : nat) 
    (lane_width : Z) (acc : idx) : M idx :=
    match num_remaining with
    | O => ret acc
    | S n =>
        lane_val <- make_lane v1 v2 lane_op lane_idx lane_width;
        new_acc <- App (
            set_slice (N.of_nat lane_idx * Z.to_N lane_width) (Z.to_N lane_width), 
            [acc; lane_val]);
        vector_binop_aux v1 v2 lane_op (S lane_idx) n lane_width new_acc
    end.

Definition SymexNormalInstruction {opts : symbolic_options_computed_opt} {descr:description} 
    (instr : NormalInstruction) : M unit :=
    match instr.(Syntax.op), instr.(args) with
    ...
    | vpaddq, [dst; src1; src2] => (* packed add of quadwords *)
        SymbolicVector.SymexVectorBinOp dst src1 src2 (add 64) 4 64
    ...



Variant op := ... | vadd (lane_width num_lanes : N) | vsub (lane_width num_lanes : N).



