import { notFound } from 'next/navigation';
import { OrderDetailScreen } from '../../order-detail';
import { isRequestId } from '../../rules';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isRequestId(id)) notFound();
  return <OrderDetailScreen requestId={id} />;
}
