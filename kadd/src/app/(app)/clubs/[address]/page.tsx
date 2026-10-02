import { notFound } from "next/navigation";
import { isAddress } from "viem";
import ClubDetail from "@/components/ClubDetail";

export default async function Page(props: PageProps<"/clubs/[address]">) {
  const { address } = await props.params;
  if (!isAddress(address)) notFound();
  return <ClubDetail address={address} />;
}
