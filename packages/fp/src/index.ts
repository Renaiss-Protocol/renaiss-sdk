import { type ErrorCode, errResponse } from '@renaiss-protocol/error-codes';
import { either, function as fn, taskEither } from 'fp-ts';
import { StatusCodes } from 'http-status-codes';

export const { flow, pipe } = fn;
export const TE = taskEither;
export { StatusCodes };

export type ApiError<Code extends ErrorCode = ErrorCode> = {
  code: Code;
  status: StatusCodes;
  detail: string;
  error?: unknown; // may contains error | Failed[]
};

const { isLeft, isRight, left, right } = either;

export const Success = right;

export type Failed<Code extends ErrorCode = ErrorCode> = either.Left<
  ApiError<Code>
>;

export const Failed = <Code extends ErrorCode>(
  code: Code,
  status: StatusCodes,
  detail?: string,
  error?: unknown,
): either.Either<ApiError<Code>, never> => {
  const response = errResponse(code, detail) as unknown as {
    code: Code;
    detail: string;
  };

  return left({
    ...response,
    status,
    error,
  });
};

export const isFailed = isLeft;
export const isSuccess = isRight;

export const getValue = <Value>(r: either.Right<Value>) => r.right;
export const getError = <Err>(r: either.Either<Err, never>) =>
  (r as either.Left<Err>).left;

/**
 * create an action, the function will never throw exception since we provided
 * `onRejected`
 * @returns
 */
export const action =
  <T, Code extends ErrorCode = ErrorCode>(
    f: Action<T, Code>,
    onRejected: (reason: unknown) => either.Either<ApiError<Code>, never>,
  ): Action<T, Code> =>
  async () => {
    try {
      return await run(f); // need await here to catch err properly
    } catch (error) {
      return onRejected(error);
    }
  };

/**
 * run an Action
 * @param fn the action
 */
export const run = <T, Code extends ErrorCode = ErrorCode>(
  fn: Action<T, Code>,
) => fn();

/**
 * Runs an Action at framework boundaries that require thrown failures.
 *
 * Use this only when integrating action-based backend functions with APIs that
 * represent failure by throwing, such as auth hooks or route handlers.
 */
export const runActionOrThrow = async <T>(
  action: Action<T>,
  message: string,
): Promise<T> => {
  const result = await run(action);

  if (isFailed(result)) {
    const error = result.left satisfies ApiError;

    throw new Error(error.detail || message, { cause: error });
  }

  return getValue(result);
};

export type Result<Value, Code extends ErrorCode = ErrorCode> = either.Either<
  ApiError<Code>,
  Value
>;

// Action can be viewed as () => Promise<Result<Value>>
export type Action<
  Value,
  Code extends ErrorCode = ErrorCode,
> = taskEither.TaskEither<ApiError<Code>, Value>;
// export const action:

/*
 * combineResults is a helper function to combine multiple results into a single result.
 * It will return a Success if all results are Success.
 * It will return a Failed if at least one of the results is Failed.
 * In the case of Failed, it will return the worst status code and all errors.
 * @param results - an array of Result
 * @returns Result<null>
 * e.g
 * const sample = async () => {
 *   const results = await Promise.all([
 *     Promise.resolve(Success(null)),
 *     Promise.resolve(Failed("ACCESS_CODE_INVALID", 400, "Error occurred")),
 *     Promise.resolve(
 *       Failed("BLOCKCHAIN_TRANSACTION_FAILED", 500, "Error occurred")
 *     ),
 *   ]);
 *   const result = combineResults(results);
 *   if (isFailed(result)) {
 *     // handle error
 *  }
 *};
 */
export const combineResults = <T>(results: Result<T>[]): Result<null> => {
  // CONTINUE is the lowest status code num
  let worstStatusCode: StatusCodes = StatusCodes.CONTINUE;
  const errors: unknown[] = [];

  for (const result of results) {
    if (isFailed(result)) {
      if (result.left.status > worstStatusCode) {
        worstStatusCode = result.left.status;
      }
      errors.push(result.left);
    }
  }

  if (errors.length > 0) {
    return Failed(
      'MULTIPLE_ERRORS',
      worstStatusCode,
      'Multiple errors occurred',
      errors,
    );
  }

  return Success(null);
};
