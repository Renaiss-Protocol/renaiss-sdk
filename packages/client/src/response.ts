import {
  type Action,
  Failed,
  StatusCodes,
  Success,
} from '@renaiss-protocol/fp';
import type { z } from 'zod';

/**
 * Validates a value against a Zod schema, returning an {@link Action}. On a
 * schema mismatch it resolves to a `Failed` result rather than throwing, so it
 * composes with the request pipeline via `TE.chain`.
 */
export function validateWith<Schema extends z.ZodType>(
  schema: Schema,
): (data: unknown) => Action<z.output<Schema>, 'INVALID_SCHEMA'> {
  return (data: unknown) => async () => {
    const parsed = schema.safeParse(data);

    if (parsed.success) {
      return Success(parsed.data);
    }

    return Failed(
      'INVALID_SCHEMA',
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Response did not match the expected schema',
      parsed.error,
    );
  };
}
