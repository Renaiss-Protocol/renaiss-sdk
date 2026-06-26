import {
  type ApiError,
  createPublicClient,
  type GachaMachine,
  GachaMachineStage,
  getError,
  getValue,
  isFailed,
} from '@renaiss-protocol/client';
import { GachaExample } from './gacha-example';

export const dynamic = 'force-dynamic';

type InitialState = {
  error: string | null;
  packs: GachaMachine[];
};

function formatApiError(error: ApiError): string {
  return `${error.code} (${error.status}): ${error.detail}`;
}

async function loadInitialPacks(): Promise<InitialState> {
  const client = createPublicClient({
    baseUrl: process.env.RENAISS_API_URL,
  });
  const result = await client
    .listGachaMachines({
      stage: GachaMachineStage.Active,
    })
    .firstPage();

  if (isFailed(result)) {
    return {
      error: formatApiError(getError(result)),
      packs: [],
    };
  }

  return {
    error: null,
    packs: getValue(result).items,
  };
}

export default async function Page() {
  const initialState = await loadInitialPacks();

  return (
    <GachaExample
      apiConfig={{
        baseUrl: process.env.NEXT_PUBLIC_RENAISS_API_URL,
      }}
      initialError={initialState.error}
      initialPacks={initialState.packs}
    />
  );
}
