import ResumeWorkspace from "./resume-workspace";

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResumeWorkspace id={id} />;
}
