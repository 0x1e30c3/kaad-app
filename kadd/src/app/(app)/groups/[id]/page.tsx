import GroupDetail from "@/components/GroupDetail";

export default async function Page(props: PageProps<"/groups/[id]">) {
  const { id } = await props.params;
  return <GroupDetail id={id} />;
}
