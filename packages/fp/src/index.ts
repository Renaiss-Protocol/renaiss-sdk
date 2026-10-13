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
  error?: unknown; // may hold the underlying error or a list of ApiError values
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

export type Result<Value, Code extends ErrorCode = ErrorCode> = either.Either<
  ApiError<Code>,
  Value
>;

// Action can be viewed as () => Promise<Result<Value>>
export type Action<
  Value,
  Code extends ErrorCode = ErrorCode,
> = taskEither.TaskEither<ApiError<Code>, Value>;
