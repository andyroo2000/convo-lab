struct glue_msg_neural_score_req
{
  GLUE_HANDLER("nscorreq")
  GLUE_FIELD(arr_int, tokens)
  GLUE_FIELD(int, start)
};
struct glue_msg_neural_score_res
{
  GLUE_HANDLER("nscorres")
  GLUE_FIELD(float, score)
  GLUE_FIELD(arr_float, log_probs)
  GLUE_FIELD(int, n_past)
};
