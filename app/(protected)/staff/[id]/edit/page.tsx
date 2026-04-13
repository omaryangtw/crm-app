import { notFound } from "next/navigation";
import { getStaffById } from "@/app/_lib/actions/staff-actions";
import EditStaffForm from "./edit-staff-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditStaffPage({ params }: Props) {
  const { id } = await params;
  const staffId = Number(id);
  if (Number.isNaN(staffId)) notFound();

  const staff = await getStaffById(staffId);
  if (!staff) notFound();

  const defaultValues = {
    name: staff.name,
    email: staff.email ?? "",
    phone: staff.phone ?? "",
    aliases: staff.aliases.join(", "),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-6">
        編輯員工 — {staff.name}
      </h1>
      <EditStaffForm staffId={staffId} defaultValues={defaultValues} />
    </div>
  );
}
