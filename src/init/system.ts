/**
 * @deprecated This module will be removed in `7.0.0`. Use `Context` from `mingo/init/context` instead.
 */
import { OpType, useOperators } from "../core";
import * as accumulatorOperators from "../operators/accumulator";
import * as expressionOperators from "../operators/expression";
import * as pipelineOperators from "../operators/pipeline";
import * as projectionOperators from "../operators/projection";
import * as queryOperators from "../operators/query";
import * as windowOperators from "../operators/window";

useOperators(OpType.ACCUMULATOR, accumulatorOperators);
useOperators(OpType.EXPRESSION, expressionOperators);
useOperators(OpType.PIPELINE, pipelineOperators);
useOperators(OpType.PROJECTION, projectionOperators);
useOperators(OpType.QUERY, queryOperators);
useOperators(OpType.WINDOW, windowOperators);
