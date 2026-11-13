type TradeOwnerRefresh = {
  expectedOwner: string;
  readOwner: () => Promise<string | undefined>;
  isCurrent: () => boolean;
  onPending: () => void;
};

/** Re-read after settlement while the public API catches up with ownership. */
export async function refreshTradeOwner({
  expectedOwner,
  readOwner,
  isCurrent,
  onPending,
}: TradeOwnerRefresh): Promise<'updated' | 'delayed' | 'cancelled'> {
  const deadline = Date.now() + 30_000;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!isCurrent()) return 'cancelled';
    const owner = await readOwner();
    if (!isCurrent()) return 'cancelled';
    if (owner?.toLowerCase() === expectedOwner.toLowerCase()) return 'updated';
    if (owner === undefined) return 'delayed';
    if (attempt === 0) onPending();
    if (attempt === 19 || Date.now() + 1500 >= deadline) return 'delayed';
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return 'delayed';
}
